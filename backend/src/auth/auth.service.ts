import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { resolveEdvanceIdFromAlias } from '../common/generate-edvance-id';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.types';
import { PermissionsService } from './permissions.service';
import { STUDENT_ROLE } from './roles.constants';

const REFRESH_TOKEN_BCRYPT_ROUNDS = 10;
const PASSWORD_BCRYPT_ROUNDS = 10;

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
  /** True until this user sets their own password — the frontend forces a
   * change-password screen while this is true, regardless of role. */
  mustChangePassword: boolean;
  /** Only populated when role.name === 'STUDENT' — mirrors how a Teacher's
   * profile isn't surfaced here either; the frontend fetches teacher profile
   * data from its own endpoints. Kept minimal: just enough for the shell/nav
   * to show "Class 6 - A" without a second round trip on every page load. */
  student?: {
    id: number;
    admissionNo: string | null;
    class: { id: number; name: string };
    section: { id: number; name: string };
  };
}

type UserWithRole = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  roleId: number;
  role: { id: number; name: string };
  mustChangePassword: boolean;
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
    identifier: string,
    password: string,
  ): Promise<{ tokens: AuthTokens; user: AuthenticatedUserView }> {
    const user = await this.findUserByIdentifier(identifier);

    // Checked before isActive, deliberately: only someone who already knows
    // the correct password learns that an account exists and is disabled —
    // a wrong password alone still gets the same generic message either way,
    // so this doesn't turn into an account-enumeration oracle.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Sorry, you are not authorized. Please contact your administrator.');
    }

    const tokens = await this.issueTokens(user);
    const view = await this.toUserView(user);
    return { tokens, user: view };
  }

  /** Tries an exact `email` match first (the common case); if that misses,
   * treats the identifier as a short login alias (e.g. 'tch000123'),
   * reverses it back to the canonical edvanceId, and looks up by that
   * instead. A real email never matches the alias shape, so this never
   * shadows a legitimate email login. */
  private async findUserByIdentifier(identifier: string): Promise<UserWithRole | null> {
    const byEmail = await this.prisma.user.findUnique({
      where: { email: identifier },
      include: { role: true },
    });
    if (byEmail) return byEmail;

    const edvanceId = resolveEdvanceIdFromAlias(identifier);
    if (!edvanceId) return null;
    return this.prisma.user.findUnique({ where: { edvanceId }, include: { role: true } });
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

    let student: AuthenticatedUserView['student'];
    if (user.role.name === STUDENT_ROLE) {
      const profile = await this.prisma.student.findUnique({
        where: { userId: user.id },
        include: { class: true, section: true },
      });
      if (profile) {
        student = {
          id: profile.id,
          admissionNo: profile.admissionNo,
          class: { id: profile.class.id, name: profile.class.name },
          section: { id: profile.section.id, name: profile.section.name },
        };
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: { id: user.role.id, name: user.role.name },
      permissions,
      mustChangePassword: user.mustChangePassword,
      student,
    };
  }

  /** Available to any authenticated user for their own account — the same
   * endpoint serves both the forced first-login change and a later voluntary
   * change from Settings; only the frontend's messaging differs between them. */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthenticatedUserView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { role: true },
    });

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
      include: { role: true },
    });
    return this.toUserView(updated);
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
