import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Fail fast on a bad `.env` instead of crashing halfway through a request.
 * Secrets that later modules need (JWT) are validated here already so that a
 * missing value shows up at boot, not at the first login attempt.
 */
export class EnvVars {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // `@Type` is required, not decorative: env values always arrive as strings.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(16, { message: 'JWT_ACCESS_SECRET must be at least 16 characters' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16, { message: 'JWT_REFRESH_SECRET must be at least 16 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  // --- QR teacher attendance (Module: anti-proxy check-in) --------------------
  // Optional so an environment that hasn't rolled out the feature still boots;
  // the kiosk/scan endpoints return 503 when it's unset. Kept separate from the
  // auth JWT secrets on purpose — a leak of one must not forge the other.
  @IsString()
  @IsOptional()
  @MinLength(16, { message: 'ATT_QR_SECRET must be at least 16 characters' })
  ATT_QR_SECRET?: string;

  /** Seconds a scannable QR token stays valid. Keep short — this is the anti-proxy budget. */
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(120)
  @IsOptional()
  ATT_QR_TOKEN_TTL_SEC: number = 25;

  /** Seconds between the kiosk pulling a fresh token. Must be < TTL so tokens overlap. */
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  @IsOptional()
  ATT_QR_ROTATE_SEC: number = 12;

  /** Extra grace on top of TTL when validating a scan, for camera/scan lag. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  @IsOptional()
  ATT_QR_GRACE_SEC: number = 5;

  /** Lifetime of a kiosk display session token (admin-minted, narrow scope). */
  @IsString()
  @IsOptional()
  ATT_QR_KIOSK_SESSION_TTL: string = '12h';

  /** IANA zone that defines "today" and the late cutoff for a scan. */
  @IsString()
  @IsOptional()
  SCHOOL_TZ: string = 'Asia/Kolkata';

  /** HH:mm in SCHOOL_TZ; a scan at or after this marks LATE instead of PRESENT. */
  @IsString()
  @IsOptional()
  ATT_CUTOFF: string = '09:00';

  /** Phase 5 switch: when 'false', a plain TEACHER can no longer self-mark via
   * POST /attendance/teachers and must use the QR scan instead. */
  @IsIn(['true', 'false'])
  @IsOptional()
  TEACHER_MANUAL_MARK_ENABLED: string = 'true';

  /** Comma-separated list of allowed browser origins. */
  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:5173';

  // Assignment attachments (backend/src/cloudinary) — local disk doesn't
  // survive a serverless deploy, so these are required, not optional.
  @IsString()
  @MinLength(1)
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  @MinLength(1)
  CLOUDINARY_API_KEY!: string;

  @IsString()
  @MinLength(1)
  CLOUDINARY_API_SECRET!: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const config = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return config;
}
