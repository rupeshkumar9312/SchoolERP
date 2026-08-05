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
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students.query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermission('student.view')
  findAll(@Query() query: ListStudentsQueryDto) {
    return this.students.findAll(query);
  }

  // Registered before ':id' — otherwise Express would match this path with
  // id="my-classes" first and 400 on the int parse.
  @Get('my-classes')
  findMyClasses(@CurrentUser() user: AuthenticatedUser) {
    return this.students.findForTeacher(user.id);
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
