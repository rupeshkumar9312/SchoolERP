import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUPER_ADMIN_ROLE } from './roles.constants';

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  keys: Set<string>;
  expiresAt: number;
}

/** Role -> permission-key mappings are seeded once (prisma/seed.ts) and have
 * no runtime mutation path anywhere in the API — but every permission-gated
 * request re-derives this from the DB regardless. A short TTL cache turns
 * that into a once-a-minute-per-role query instead of a per-request one,
 * with no invalidation hook needed today; if a role/permission admin screen
 * is ever added, clear `cache` from that mutation path. */
@Injectable()
export class PermissionsService {
  private readonly cache = new Map<number, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  /** SUPER_ADMIN implicitly holds every permission, seeded rows or not. */
  async getPermissionKeysForRole(roleId: number, roleName: string): Promise<string[]> {
    if (roleName === SUPER_ADMIN_ROLE) {
      const all = await this.prisma.permission.findMany({ select: { key: true } });
      return all.map((p) => p.key);
    }

    const keys = await this.getCachedKeys(roleId);
    return [...keys];
  }

  async roleHasPermission(roleId: number, roleName: string, permission: string): Promise<boolean> {
    if (roleName === SUPER_ADMIN_ROLE) return true;

    const keys = await this.getCachedKeys(roleId);
    return keys.has(permission);
  }

  private async getCachedKeys(roleId: number): Promise<Set<string>> {
    const cached = this.cache.get(roleId);
    if (cached && cached.expiresAt > Date.now()) return cached.keys;

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { key: true } } },
    });
    const keys = new Set(rows.map((r) => r.permission.key));
    this.cache.set(roleId, { keys, expiresAt: Date.now() + CACHE_TTL_MS });
    return keys;
  }
}
