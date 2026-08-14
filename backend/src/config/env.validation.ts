import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
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
