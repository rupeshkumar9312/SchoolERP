import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  // Gated on user.view since the only current consumer is the user create/edit
  // role dropdown — add a dedicated permission if roles get their own screen.
  @Get()
  @RequirePermission('user.view')
  findAll() {
    return this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
  }
}
