import {
  Body,
  Controller,
  Get,
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
import { AttendanceService } from './attendance.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance.query.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('attendance/students')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @RequirePermission('attendance.student.view')
  findAll(@Query() query: ListAttendanceQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.attendance.findAll(query, actor);
  }

  // No @RequirePermission — a STUDENT holds no permissions at all, this is a
  // "me" route like /teachers/me/assignments, scoped by the caller's own id.
  @Get('me')
  findMyAttendance(@CurrentUser() actor: AuthenticatedUser) {
    return this.attendance.findForStudent(actor.id);
  }

  @Get(':studentId/history')
  @RequirePermission('attendance.student.view')
  findHistoryForStudent(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: HistoryQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendance.findHistoryForStudent(studentId, actor, query);
  }

  @Post()
  @RequirePermission('attendance.student.mark')
  markBulk(@Body() dto: MarkAttendanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.attendance.markBulk(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('attendance.student.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendance.update(id, dto, actor);
  }
}
