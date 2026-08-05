import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { TeacherAttendanceController } from './teacher-attendance.controller';
import { TeacherAttendanceService } from './teacher-attendance.service';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController, TeacherAttendanceController],
  providers: [AttendanceService, TeacherAttendanceService],
})
export class AttendanceModule {}
