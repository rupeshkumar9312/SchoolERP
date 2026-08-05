import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import {
  AttendanceSummaryQueryDto,
  DefaultersQueryDto,
  StaffAttendanceSummaryQueryDto,
} from './dto/report-queries.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('attendance-summary')
  @RequirePermission('academic.view')
  getAttendanceSummary(@Query() query: AttendanceSummaryQueryDto) {
    return this.reports.getAttendanceSummary(query);
  }

  @Get('defaulters')
  @RequirePermission('academic.view')
  getDefaulters(@Query() query: DefaultersQueryDto) {
    return this.reports.getDefaulters(query);
  }

  @Get('staff-attendance-summary')
  @RequirePermission('academic.view')
  getStaffAttendanceSummary(@Query() query: StaffAttendanceSummaryQueryDto) {
    return this.reports.getStaffAttendanceSummary(query);
  }
}
