import {
  Body,
  Controller,
  HttpCode,
  Post,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';

const REFRESH_COOKIE_NAME = 'refresh_token';
/** Scoped to /api/auth so the cookie is never sent on unrelated requests. */
const REFRESH_COOKIE_PATH = '/api/auth';
/** Sent by the React Native app only — never by the web SPA. Native clients
 * can't rely on an httpOnly cookie surviving app restarts, so for them (and
 * only them) the refresh token is also handed back in the JSON body for the
 * app to store itself. Including it in the body for web would defeat the
 * whole point of httpOnly (an XSS payload could just read the fetch response). */
const MOBILE_CLIENT_HEADER = 'x-client';
const MOBILE_CLIENT_VALUE = 'mobile';

function isMobileClient(req: Request): boolean {
  return req.headers[MOBILE_CLIENT_HEADER] === MOBILE_CLIENT_VALUE;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      ...(isMobileClient(req) ? { refreshToken: tokens.refreshToken } : {}),
      user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME] ??
      dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('No refresh token supplied');
    }

    const { tokens, user } = await this.auth.refresh(token);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      ...(isMobileClient(req) ? { refreshToken: tokens.refreshToken } : {}),
      user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.id);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getMe(user.id);
  }

  // Serves both the forced first-login change and a later voluntary change
  // from Settings — the frontend decides which screen to show, this endpoint
  // doesn't care why it was called.
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return { user: await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword) };
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }
}
