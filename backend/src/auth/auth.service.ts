import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.types';
import { PermissionsService } from './permissions.service';

const REFRESH_TOKEN_BCRYPT_ROUNDS = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUserView {
  id: number;
  email: string;
  name: string;
  role: { id: number; name: string };
  permissions: string[];
}

type UserWithRole = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  roleId: number;
  role: { id: number; name: string };
  hashedRefreshToken: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly permissions: PermissionsService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ tokens: AuthTokens; user: AuthenticatedUserView }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user);
    const view = await this.toUserView(user);
    return { tokens, user: view };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ tokens: AuthTokens; user: AuthenticatedUserView }> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      // Token reuse after rotation, or a stale/forged token — kill the session.
      await this.prisma.user.update({ where: { id: user.id }, data: { hashedRefreshToken: null } });
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const tokens = await this.issueTokens(user);
    const view = await this.toUserView(user);
    return { tokens, user: view };
  }

  async logout(userId: number): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { hashedRefreshToken: null } });
  }

  async getMe(userId: number): Promise<AuthenticatedUserView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { role: true },
    });
    return this.toUserView(user);
  }

  private async toUserView(user: UserWithRole): Promise<AuthenticatedUserView> {
    const permissions = await this.permissions.getPermissionKeysForRole(
      user.roleId,
      user.role.name,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: { id: user.role.id, name: user.role.name },
      permissions,
    };
  }

  private async issueTokens(user: UserWithRole): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as JwtSignOptions['expiresIn'],
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, REFRESH_TOKEN_BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: user.id }, data: { hashedRefreshToken } });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
