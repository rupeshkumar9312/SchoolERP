import { Module } from '@nestjs/common';
import { LoginAuditController } from './login-audit.controller';
import { LoginAuditService } from './login-audit.service';

@Module({
  controllers: [LoginAuditController],
  providers: [LoginAuditService],
  exports: [LoginAuditService],
})
export class LoginAuditModule {}
