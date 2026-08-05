import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin-summary')
  @RequirePermission('academic.view')
  getAdminSummary() {
    return this.dashboard.getAdminSummary();
  }

  // No @RequirePermission — a bare TEACHER has no permissions at all here, this
  // is a "me" route like /teachers/me/assignments, scoped by the caller's own id.
  @Get('teacher-summary')
  getTeacherSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getTeacherSummary(user.id);
  }
}
