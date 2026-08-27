import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

/**
 * Full replace of the singleton QR check-in settings (geofence + check-out).
 * `enabled` may only be set true when latitude and longitude are present —
 * enforced in GeofenceConfigService, not here, so the error can be specific.
 */
export class UpdateGeofenceConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  /** Accepted distance from the campus centre, in metres. */
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(5000)
  radiusM!: number;

  /** Worst GPS accuracy radius a scan may report and still be trusted, in metres. */
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(1000)
  maxAccuracyM!: number;

  // --- check-out settings -------------------------------------------------
  @IsOptional()
  @IsBoolean()
  checkoutEnabled?: boolean;

  /** "HH:mm" 24h, or null for manual-toggle-only. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'checkoutAutoSwitchAt must be "HH:mm"' })
  checkoutAutoSwitchAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  minSessionMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowCheckoutWithoutCheckin?: boolean;
}
