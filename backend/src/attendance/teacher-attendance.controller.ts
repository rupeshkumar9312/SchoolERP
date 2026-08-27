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
import { CorrectTeacherAttendanceDto } from './dto/correct-teacher-attendance.dto';
import { ListTeacherAttendanceQueryDto } from './dto/list-teacher-attendance.query.dto';
import { MarkTeacherAttendanceDto } from './dto/mark-teacher-attendance.dto';
import { TeacherAttendanceService } from './teacher-attendance.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('attendance/teachers')
export class TeacherAttendanceController {
  constructor(private readonly attendance: TeacherAttendanceService) {}

  @Get()
  @RequirePermission('attendance.teacher.view')
  findAll(@Query() query: ListTeacherAttendanceQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.attendance.findAll(query, actor);
  }

  /** Lets the teacher self-mark UIs (web /my-attendance, mobile) hide the manual
   * controls when Phase 5 has switched the app to QR-only check-in. */
  @Get('self-serve-config')
  @RequirePermission('attendance.teacher.mark')
  selfServeConfig() {
    return this.attendance.getSelfServeConfig();
  }

  @Post()
  @RequirePermission('attendance.teacher.mark')
  mark(@Body() dto: MarkTeacherAttendanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.attendance.mark(dto, actor);
  }

  /** Admin-only correction of check-in / check-out times for a missed scan. */
  @Patch(':id')
  @RequirePermission('attendance.teacher.mark')
  correct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorrectTeacherAttendanceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendance.correct(id, dto, actor);
  }
}
