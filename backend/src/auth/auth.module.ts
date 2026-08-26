import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LoginAuditModule } from '../login-audit/login-audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionsService } from './permissions.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), LoginAuditModule],
  controllers: [AuthController],
  providers: [AuthService, PermissionsService, PermissionGuard, JwtAccessStrategy],
  exports: [PermissionsService, PermissionGuard],
})
export class AuthModule {}
