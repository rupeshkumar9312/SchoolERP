import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { ListLoginAuditsQueryDto } from './dto/list-login-audits.query.dto';
import { LoginAuditService } from './login-audit.service';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('audit-logins')
export class LoginAuditController {
  constructor(private readonly loginAudits: LoginAuditService) {}

  @Get()
  findAll(@Query() query: ListLoginAuditsQueryDto) {
    return this.loginAudits.findAll(query);
  }
}
