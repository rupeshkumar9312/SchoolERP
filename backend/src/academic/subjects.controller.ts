import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AcademicService } from './academic.service';
import { CreateSubjectDto, ListSubjectsQueryDto, UpdateSubjectDto } from './dto/subject.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly academic: AcademicService) {}

  @Get()
  @RequirePermission('academic.view')
  findAll(@Query() query: ListSubjectsQueryDto) {
    return this.academic.findAllSubjects(query);
  }

  @Post()
  @RequirePermission('academic.manage')
  create(@Body() dto: CreateSubjectDto) {
    return this.academic.createSubject(dto);
  }

  @Patch(':id')
  @RequirePermission('academic.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectDto) {
    return this.academic.updateSubject(id, dto);
  }

  @Delete(':id')
  @RequirePermission('academic.manage')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.academic.removeSubject(id);
  }
}
