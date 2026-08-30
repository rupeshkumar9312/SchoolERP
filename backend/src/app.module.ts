import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcademicModule } from './academic/academic.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExamsModule } from './exams/exams.module';
import { HealthModule } from './health/health.module';
import { HolidaysModule } from './holidays/holidays.module';
import { LoginAuditModule } from './login-audit/login-audit.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
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
    // Global request-rate cap, applied per client IP. Route-specific
    // overrides (tighter on login/refresh) live via @Throttle() on those
    // handlers; @SkipThrottle() exempts the health-check routes so an
    // uptime prober can never trip it. See ThrottlerGuard registration
    // below — trust-proxy is enabled in main.ts so this reads the real
    // client IP behind Render's load balancer, not the proxy's.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuditModule,
    LoginAuditModule,
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
    AnnouncementsModule,
    PushNotificationsModule,
    ExamsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
