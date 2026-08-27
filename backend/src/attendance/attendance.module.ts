import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { GeofenceConfigService } from './geofence-config.service';
import { KioskTokenGuard } from './guards/kiosk-token.guard';
import { TeacherAttendanceController } from './teacher-attendance.controller';
import { TeacherAttendanceService } from './teacher-attendance.service';
import { TeacherQrController } from './teacher-qr.controller';
import { TeacherQrService } from './teacher-qr.service';

@Module({
  imports: [AuthModule, AuditModule, JwtModule.register({})],
  controllers: [AttendanceController, TeacherAttendanceController, TeacherQrController],
  providers: [
    AttendanceService,
    TeacherAttendanceService,
    TeacherQrService,
    GeofenceConfigService,
    KioskTokenGuard,
  ],
})
export class AttendanceModule {}
