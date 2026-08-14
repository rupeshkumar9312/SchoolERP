import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AssignmentsBulkImportService } from './assignments-bulk-import.service';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments.query.dto';
import { SetSubmissionDto } from './dto/set-submission.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly bulkImport: AssignmentsBulkImportService,
  ) {}

  @Get()
  @RequirePermission('assignment.view')
  findAll(@Query() query: ListAssignmentsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.findAll(query, user);
  }

  // Registered before ':id' — otherwise Express would match this path with id="bulk-import".
  @Get('bulk-import/template')
  @RequirePermission('assignment.create')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="assignment-import-template.xlsx"')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.bulkImport.buildTemplate();
    res.send(buffer);
  }

  @Post('bulk-import')
  @RequirePermission('assignment.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }))
  bulkImportAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (!isXlsx) throw new BadRequestException('Please upload a .xlsx file.');
    return this.bulkImport.bulkImport(file.buffer, user);
  }

  // No @RequirePermission — a STUDENT holds no permissions at all, this is a
  // "me" route like /teachers/me/assignments, scoped by the caller's own id.
  // Registered before ':id' — otherwise Express would match this path with id="me".
  @Get('me')
  findMyAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.assignments.findForStudent(user.id);
  }

  // No @RequirePermission here either: assertMayView() inside findOne() is the
  // real authorization (teacher-owns-only, student-own-class-only, admin
  // unrestricted) — a blanket permission gate can't express "own class" scoping.
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.findOne(id, user);
  }

  @Post()
  @RequirePermission('assignment.create')
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('assignment.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignments.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('assignment.delete')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.remove(id, user);
  }

  @Post(':id/attachment')
  @RequirePermission('assignment.edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  attachFile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    return this.assignments.attachFile(id, user, file);
  }

  @Delete(':id/attachment')
  @RequirePermission('assignment.edit')
  removeAttachment(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.removeAttachment(id, user);
  }

  // No @RequirePermission — same reasoning as GET ':id' above; getAttachmentForDownload()
  // re-runs assertMayView() so a STUDENT can only download their own class's attachments.
  // The file itself is proxied through, not redirected to — a Cloudinary
  // signed URL in a 302 would leak into the client's network log/history,
  // reintroducing the exact bypass-auth risk a static mount would have had.
  @Get(':id/attachment')
  async downloadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { url, fileName, mimeType } = await this.assignments.getAttachmentForDownload(id, user);
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      throw new BadRequestException('Could not retrieve the attachment');
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }

  @Get(':id/submissions')
  @RequirePermission('assignment.view')
  listSubmissions(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.listSubmissions(id, user);
  }

  @Patch(':id/submissions/:studentId')
  @RequirePermission('assignment.edit')
  setSubmission(
    @Param('id', ParseIntPipe) id: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: SetSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignments.setSubmission(id, studentId, dto, user);
  }
}
