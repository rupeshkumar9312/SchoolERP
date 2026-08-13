import { IsOptional, IsString } from 'class-validator';

/** Web never sends a body here — it relies solely on the httpOnly cookie.
 * Native clients can't persist an httpOnly cookie reliably, so they send the
 * refresh token they stored themselves as a fallback when no cookie arrives. */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
