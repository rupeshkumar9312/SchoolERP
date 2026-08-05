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
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { SetClassTeacherDto } from './dto/set-class-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeachersService } from './teachers.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  @RequirePermission('teacher.view')
  findAll() {
    return this.teachers.findAll();
  }

  // Registered before ':id/assignments' — otherwise Express would match
  // this path with id="me" first and 400 on the int parse.
  @Get('me/assignments')
  findMyAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.teachers.findMyAssignments(user.id);
  }

  // Same ordering reason as above — before ':id/class-teacher-of'.
  @Get('me/class-teacher-of')
  findMyClassTeacherOf(@CurrentUser() user: AuthenticatedUser) {
    return this.teachers.findMyClassTeacherOf(user.id);
  }

  @Get(':id')
  @RequirePermission('teacher.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teachers.findOne(id);
  }

  @Post()
  @RequirePermission('teacher.create')
  create(@Body() dto: CreateTeacherDto) {
    return this.teachers.create(dto);
  }

  @Patch(':id')
  @RequirePermission('teacher.edit')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeacherDto) {
    return this.teachers.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('teacher.delete')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teachers.remove(id);
  }

  @Get(':id/assignments')
  @RequirePermission('teacher.view')
  findAssignments(@Param('id', ParseIntPipe) id: number) {
    return this.teachers.findAssignments(id);
  }

  @Post(':id/assignments')
  @RequirePermission('teacher.assign')
  createAssignment(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateAssignmentDto) {
    return this.teachers.createAssignment(id, dto);
  }

  @Delete(':id/assignments/:assignmentId')
  @RequirePermission('teacher.assign')
  @HttpCode(204)
  removeAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ) {
    return this.teachers.removeAssignment(id, assignmentId);
  }

  @Get(':id/class-teacher-of')
  @RequirePermission('teacher.view')
  findClassTeacherOf(@Param('id', ParseIntPipe) id: number) {
    return this.teachers.findClassTeacherOf(id);
  }

  @Post(':id/class-teacher')
  @RequirePermission('teacher.assign')
  setClassTeacher(@Param('id', ParseIntPipe) id: number, @Body() dto: SetClassTeacherDto) {
    return this.teachers.setClassTeacher(id, dto);
  }

  @Delete(':id/class-teacher/:sectionId')
  @RequirePermission('teacher.assign')
  @HttpCode(204)
  unsetClassTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
  ) {
    return this.teachers.unsetClassTeacher(id, sectionId);
  }
}
