import { Body, Controller, Get, Header, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ScanTeacherAttendanceDto } from './dto/scan-teacher-attendance.dto';
import { UpdateGeofenceConfigDto } from './dto/update-geofence-config.dto';
import { GeofenceConfigService } from './geofence-config.service';
import { KioskTokenGuard, type KioskRequest } from './guards/kiosk-token.guard';
import { TeacherQrService } from './teacher-qr.service';

@Controller('attendance')
export class TeacherQrController {
  constructor(
    private readonly qr: TeacherQrService,
    private readonly geofence: GeofenceConfigService,
  ) {}

  /** Admin provisions a display session for a kiosk device. */
  @Post('teacher-qr/kiosk-session')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('attendance.teacher.qr.manage')
  createKioskSession(@CurrentUser() actor: AuthenticatedUser) {
    return this.qr.createKioskSession(actor);
  }

  /** Kiosk polls this (~every rotateSec) for the token to display. `mode=out`
   * returns the check-out QR (400 if check-out is disabled); anything else is
   * the check-in QR. */
  @Get('teacher-qr/current')
  @UseGuards(KioskTokenGuard)
  @Header('Cache-Control', 'no-store')
  current(@Req() req: KioskRequest, @Query('mode') mode?: string) {
    return this.qr.getCurrentToken(req.kiosk, mode === 'out' ? 'out' : 'in');
  }

  /** Teacher scans the on-screen QR from their own device. */
  @Post('teachers/scan')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('attendance.teacher.mark')
  scan(@Body() dto: ScanTeacherAttendanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.qr.scan(dto, actor);
  }

  /** Admin reads the DB-stored geofence for QR check-in. */
  @Get('teacher-qr/geofence')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('attendance.teacher.qr.manage')
  getGeofence() {
    return this.geofence.get();
  }

  /** Admin sets the geofence — centre, radius, accuracy ceiling, on/off. */
  @Patch('teacher-qr/geofence')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('attendance.teacher.qr.manage')
  updateGeofence(@Body() dto: UpdateGeofenceConfigDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.geofence.update(dto, actor.id);
  }
}
