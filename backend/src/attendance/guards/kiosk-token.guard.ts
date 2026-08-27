import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/** Claims carried by a kiosk display-session token (see TeacherQrService.createKioskSession). */
export interface KioskTokenClaims {
  typ: 'kiosk';
  /** Stable id for this display/location — copied onto every attendance token it pulls. */
  sid: string;
  /** User id of the admin who provisioned the session, for the audit trail. */
  by: number;
}

export interface KioskRequest extends Request {
  kiosk: KioskTokenClaims;
}

/**
 * Authenticates the wall-mounted display, not a person. A kiosk token is minted
 * by an admin (POST .../kiosk-session), signed with ATT_QR_SECRET, and only ever
 * accepted here — it grants nothing but the right to pull the current QR.
 */
@Injectable()
export class KioskTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secret = this.config.get<string>('ATT_QR_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('QR attendance is not configured on this server');
    }

    const request = context.switchToHttp().getRequest<KioskRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing kiosk session token');
    }

    let claims: KioskTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<KioskTokenClaims>(token, { secret });
    } catch {
      throw new UnauthorizedException('Kiosk session token is invalid or expired');
    }
    if (claims.typ !== 'kiosk') {
      throw new UnauthorizedException('Not a kiosk session token');
    }

    request.kiosk = claims;
    return true;
  }
}
