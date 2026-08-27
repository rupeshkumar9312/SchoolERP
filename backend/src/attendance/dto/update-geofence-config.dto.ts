import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Full replace of the singleton geofence config. `enabled` may only be set true
 * when latitude and longitude are present — enforced in GeofenceConfigService,
 * not here, so the error message can be specific.
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
}
