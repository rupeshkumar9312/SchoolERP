import { Type } from 'class-transformer';
import { IsBoolean, IsJWT, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Body for POST /attendance/teachers/scan. `token` is the compact JWT lifted
 * straight out of the scanned QR. The coordinates are captured opportunistically
 * — the mobile app only started sending them once the Phase 6 geofence lands, so
 * they stay optional and are stored for later, not yet enforced.
 */
export class ScanTeacherAttendanceDto {
  @IsJWT()
  token!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** GPS accuracy radius in metres, as reported by the device. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;

  /** Android can flag a fix as coming from a mock-location provider. When the
   * geofence is on, a true value is rejected. */
  @IsOptional()
  @IsBoolean()
  mocked?: boolean;
}
