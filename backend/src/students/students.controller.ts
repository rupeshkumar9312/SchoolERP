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
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students.query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsBulkImportService } from './students-bulk-import.service';
import { StudentsService } from './students.service';

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly bulkImport: StudentsBulkImportService,
  ) {}

  @Get()
  @RequirePermission('student.view')
  findAll(@Query() query: ListStudentsQueryDto) {
    return this.students.findAll(query);
  }

  // Registered before ':id' — otherwise Express would match this path with
  // id="my-classes" (or "bulk-import") first and 400 on the int parse.
  @Get('my-classes')
  findMyClasses(@CurrentUser() user: AuthenticatedUser) {
    return this.students.findForTeacher(user.id);
  }

  @Get('bulk-import/template')
  @RequirePermission('student.create')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="student-import-template.xlsx"')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.bulkImport.buildTemplate();
    res.send(buffer);
  }

  @Post('bulk-import')
  @RequirePermission('student.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }))
  bulkImportStudents(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (!isXlsx) throw new BadRequestException('Please upload a .xlsx file.');
    return this.bulkImport.bulkImport(file.buffer);
  }

  @Get(':id')
  @RequirePermission('student.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.students.findOne(id);
  }

  @Post()
  @RequirePermission('student.create')
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }

  @Patch(':id')
  @RequirePermission('student.edit')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('student.delete')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.students.remove(id);
  }
}
