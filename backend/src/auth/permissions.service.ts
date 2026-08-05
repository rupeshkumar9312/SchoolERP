import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUPER_ADMIN_ROLE } from './roles.constants';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** SUPER_ADMIN implicitly holds every permission, seeded rows or not. */
  async getPermissionKeysForRole(roleId: number, roleName: string): Promise<string[]> {
    if (roleName === SUPER_ADMIN_ROLE) {
      const all = await this.prisma.permission.findMany({ select: { key: true } });
      return all.map((p) => p.key);
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { key: true } } },
    });
    return rows.map((r) => r.permission.key);
  }

  async roleHasPermission(roleId: number, roleName: string, permission: string): Promise<boolean> {
    if (roleName === SUPER_ADMIN_ROLE) return true;

    const match = await this.prisma.rolePermission.findFirst({
      where: { roleId, permission: { key: permission } },
      select: { roleId: true },
    });
    return match !== null;
  }
}
