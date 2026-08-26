import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SUPER_ADMIN_ROLE } from '../auth/roles.constants';
import { edvanceLoginAlias, nextEdvanceId } from '../common/generate-edvance-id';
import { generateTempPassword } from '../common/generate-temp-password';
import { PaginatedResult, resolvePagination } from '../common/pagination';
import { withTransactionRetry } from '../common/with-transaction-retry';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PASSWORD_BCRYPT_ROUNDS = 10;
const ADMIN_LOGIN_EMAIL_DOMAIN = 'admin.edvance.edu';

export interface UserView {
  id: number;
  email: string;
  edvanceId: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  role: { id: number; name: string };
  createdAt: Date;
}

export interface UserCreateResult extends UserView {
  /** Shown once, in the create response only — never retrievable again.
   * `alias` is the short form of `email` (e.g. 'adm001') — both work at login. */
  login: { email: string; alias: string; temporaryPassword: string };
}

/** Exactly the fields toView() reads — narrower than `include: { role: true
 * }`, which pulled the whole User row (passwordHash, hashedRefreshToken
 * included) into memory on every fetch. */
const USER_SELECT = {
  id: true,
  email: true,
  edvanceId: true,
  name: true,
  phone: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListUsersQueryDto): Promise<PaginatedResult<UserView>> {
    const where: Prisma.UserWhereInput = {
      roleId: query.roleId,
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }],
          }
        : {}),
    };
    const { page, pageSize, skip, take } = resolvePagination(query);
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: users.map((u) => this.toView(u)), total, page, pageSize };
  }

  async findOne(id: number): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return this.toView(user);
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<UserCreateResult> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException('Unknown roleId');
    this.assertMayAssignRole(role.name, actor);

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_BCRYPT_ROUNDS);
    try {
      const user = await withTransactionRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const edvanceId = await nextEdvanceId(tx, 'ADM');
            const email = `${edvanceId.toLowerCase()}@${ADMIN_LOGIN_EMAIL_DOMAIN}`;
            return tx.user.create({
              data: {
                name: dto.name,
                email,
                edvanceId,
                phone: dto.phone,
                passwordHash,
                roleId: dto.roleId,
              },
              select: USER_SELECT,
            });
          },
          { maxWait: 10000, timeout: 15000 },
        ),
      );
      await this.audit.record({
        entityType: 'User',
        entityId: user.id,
        action: 'CREATE',
        userId: actor.id,
        newValues: user,
      });
      return {
        ...this.toView(user),
        login: {
          email: user.email,
          alias: edvanceLoginAlias(user.edvanceId),
          temporaryPassword,
        },
      };
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: number, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<UserView> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) throw new NotFoundException('User not found');
    this.assertMayModify(existing.role.name, actor);

    if (dto.roleId !== undefined) {
      const newRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!newRole) throw new BadRequestException('Unknown roleId');
      this.assertMayAssignRole(newRole.name, actor);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          roleId: dto.roleId,
          isActive: dto.isActive,
        },
        select: USER_SELECT,
      });
      await this.audit.record({
        entityType: 'User',
        entityId: user.id,
        action: 'UPDATE',
        userId: actor.id,
        oldValues: existing,
        newValues: user,
      });
      return this.toView(user);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) throw new NotFoundException('User not found');
    this.assertMayModify(existing.role.name, actor);

    await this.prisma.user.delete({ where: { id } });
    await this.audit.record({
      entityType: 'User',
      entityId: id,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });
  }

  /** SUPER_ADMIN-only (enforced by SuperAdminGuard on the route, not a
   * permission key — Director/Principal/Admin hold user.edit too via the
   * Management set, but must not be able to reset anyone's password).
   * Generates a fresh temp password, forces a change on next login, and
   * invalidates any existing session so a stolen/forgotten password can't
   * keep working after the reset. */
  async resetPassword(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<{ temporaryPassword: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) throw new NotFoundException('User not found');

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, hashedRefreshToken: null },
    });
    await this.audit.record({
      entityType: 'User',
      entityId: id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: { mustChangePassword: true },
    });
    return { temporaryPassword };
  }

  /** Non-SUPER_ADMIN callers may neither touch an existing SUPER_ADMIN account... */
  private assertMayModify(targetRoleName: string, actor: AuthenticatedUser): void {
    if (targetRoleName === SUPER_ADMIN_ROLE && actor.roleName !== SUPER_ADMIN_ROLE) {
      throw new ForbiddenException('Only a SUPER_ADMIN can modify a SUPER_ADMIN account');
    }
  }

  /** ...nor hand the SUPER_ADMIN role to anyone via create/edit. */
  private assertMayAssignRole(roleName: string, actor: AuthenticatedUser): void {
    if (roleName === SUPER_ADMIN_ROLE && actor.roleName !== SUPER_ADMIN_ROLE) {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }
  }

  private mapWriteError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = this.conflictTarget(error);
      if (target.includes('edvanceId')) {
        return new ConflictException('Edvance ID collision — please retry');
      }
      if (target.includes('email')) {
        return new ConflictException('A login with this generated email already exists — please retry');
      }
      return new ConflictException('A user with this value already exists');
    }
    return error as Error;
  }

  private conflictTarget(error: Prisma.PrismaClientKnownRequestError): string {
    const target = error.meta?.target;
    return Array.isArray(target) ? target.join(',') : String(target ?? '');
  }

  private toView(user: {
    id: number;
    email: string;
    edvanceId: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    role: { id: number; name: string };
    createdAt: Date;
  }): UserView {
    return {
      id: user.id,
      email: user.email,
      edvanceId: user.edvanceId,
      name: user.name,
      phone: user.phone,
      isActive: user.isActive,
      role: { id: user.role.id, name: user.role.name },
      createdAt: user.createdAt,
    };
  }
}
