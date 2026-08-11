import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AcademicModule } from './academic/academic.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { HolidaysModule } from './holidays/holidays.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    AcademicModule,
    TeachersModule,
    StudentsModule,
    AttendanceModule,
    DashboardModule,
    HolidaysModule,
    ReportsModule,
    AssignmentsModule,
  ],
})
export class AppModule {}
