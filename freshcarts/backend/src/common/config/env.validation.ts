import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Matches the JwtDuration template-literal type in configuration.ts. */
const DURATION_PATTERN = /^\d+[smhd]$/;

/**
 * Fail-fast environment validation. The process must not boot with a missing
 * database URI or a weak/absent JWT secret — those are silent security failures.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV?: NodeEnv;

  @IsInt()
  @IsOptional()
  PORT?: number;

  @IsString()
  @MinLength(1, { message: 'MONGODB_URI is required' })
  MONGODB_URI: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @Matches(DURATION_PATTERN, { message: 'JWT_ACCESS_EXPIRES_IN must look like 15m, 2h or 7d' })
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @Matches(DURATION_PATTERN, { message: 'JWT_REFRESH_EXPIRES_IN must look like 15m, 2h or 7d' })
  JWT_REFRESH_EXPIRES_IN?: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  return config;
}
