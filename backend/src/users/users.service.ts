import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthenticatedUser } from '../auth/auth.types';
import { SUPER_ADMIN_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PASSWORD_BCRYPT_ROUNDS = 10;

export interface UserView {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  role: { id: number; name: string };
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListUsersQueryDto): Promise<UserView[]> {
    const users = await this.prisma.user.findMany({
      where: {
        roleId: query.roleId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { role: true },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.toView(u));
  }

  async findOne(id: number): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) throw new NotFoundException('User not found');
    return this.toView(user);
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<UserView> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException('Unknown roleId');
    this.assertMayAssignRole(role.name, actor);

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          roleId: dto.roleId,
        },
        include: { role: true },
      });
      return this.toView(user);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: number, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<UserView> {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
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
          email: dto.email,
          phone: dto.phone,
          roleId: dto.roleId,
          isActive: dto.isActive,
        },
        include: { role: true },
      });
      return this.toView(user);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new NotFoundException('User not found');
    this.assertMayModify(existing.role.name, actor);

    await this.prisma.user.delete({ where: { id } });
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
      return new ConflictException('A user with this email already exists');
    }
    return error as Error;
  }

  private toView(user: {
    id: number;
    email: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    role: { id: number; name: string };
    createdAt: Date;
  }): UserView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isActive: user.isActive,
      role: { id: user.role.id, name: user.role.name },
      createdAt: user.createdAt,
    };
  }
}
