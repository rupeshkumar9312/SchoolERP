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
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamMarksRosterQueryDto } from './dto/exam-marks-roster.query.dto';
import { ListExamsQueryDto } from './dto/list-exams.query.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';
import { UpdateExamSubjectDto } from './dto/update-exam-subject.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamsService } from './exams.service';

// Phase 1: exam definition (admin-only). Phase 2: marks entry, added below —
// still no publish workflow (Phase 3). Exam is a name+type-only umbrella;
// every class added under it is an independent ExamSchedule (its own dates,
// subjects, status) — see the "Redesign" section of the exams-module plan.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @RequirePermission('exam.view')
  findAll(@Query() query: ListExamsQueryDto) {
    return this.exams.findAll(query);
  }

  // No @RequirePermission — a bare TEACHER holds no exam.view; this is a "me"
  // route like /assignments/me, scoped by the caller's own TeacherClassSubject
  // rows. Registered before ':id' — otherwise Express would match this path
  // with id="me".
  @Get('me')
  findForTeacher(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.findForTeacher(user);
  }

  @Get(':id')
  @RequirePermission('exam.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.exams.findOne(id);
  }

  @Post()
  @RequirePermission('exam.create')
  create(@Body() dto: CreateExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('exam.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('exam.delete')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.remove(id, user);
  }

  // Same permission as the umbrella create — this is still "create an exam,"
  // just adding one more class's independent sitting of it.
  @Post(':id/schedules')
  @RequirePermission('exam.create')
  addSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateExamScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.addSchedule(id, dto, user);
  }

  @Patch(':id/schedules/:scheduleId')
  @RequirePermission('exam.edit')
  updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: UpdateExamScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.updateSchedule(id, scheduleId, dto, user);
  }

  @Delete(':id/schedules/:scheduleId')
  @RequirePermission('exam.delete')
  removeSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.removeSchedule(id, scheduleId, user);
  }

  @Get(':id/schedules/:scheduleId/progress')
  @RequirePermission('exam.view')
  getProgress(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.exams.getProgress(id, scheduleId);
  }

  @Get(':id/schedules/:scheduleId/marks')
  @RequirePermission('exam.marks.enter')
  getMarksRoster(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Query() query: ExamMarksRosterQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.getMarksRoster(id, scheduleId, query, user);
  }

  @Post(':id/schedules/:scheduleId/marks')
  @RequirePermission('exam.marks.enter')
  saveMarks(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: BulkMarksDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.saveMarksBulk(id, scheduleId, dto, user);
  }

  @Post(':id/schedules/:scheduleId/subjects')
  @RequirePermission('exam.edit')
  addSubject(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: CreateExamSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.addSubject(id, scheduleId, dto, user);
  }

  @Patch(':id/schedules/:scheduleId/subjects/:subjectRowId')
  @RequirePermission('exam.edit')
  updateSubject(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Param('subjectRowId', ParseIntPipe) subjectRowId: number,
    @Body() dto: UpdateExamSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.updateSubject(id, scheduleId, subjectRowId, dto, user);
  }

  @Delete(':id/schedules/:scheduleId/subjects/:subjectRowId')
  @RequirePermission('exam.edit')
  removeSubject(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Param('subjectRowId', ParseIntPipe) subjectRowId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.removeSubject(id, scheduleId, subjectRowId, user);
  }
}
