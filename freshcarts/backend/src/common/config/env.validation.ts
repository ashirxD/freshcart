import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

enum RoutingProvider {
  Osrm = 'osrm',
  Estimate = 'estimate',
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

  @IsOptional()
  @IsEnum(RoutingProvider, { message: 'ROUTING_PROVIDER must be "osrm" or "estimate"' })
  ROUTING_PROVIDER?: RoutingProvider;

  /**
   * `ValidateIf` rather than `IsOptional`: an empty string is how a .env file
   * says "not configured", and `IsOptional` treats it as a value to validate.
   */
  @ValidateIf((env: EnvironmentVariables) => Boolean(env.ROUTING_OSRM_BASE_URL))
  @IsUrl({ require_tld: false }, { message: 'ROUTING_OSRM_BASE_URL must be a URL' })
  ROUTING_OSRM_BASE_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1000, { message: 'DELIVERY_MAX_DISTANCE_METERS must be at least 1000 (1 km)' })
  DELIVERY_MAX_DISTANCE_METERS?: number;

  @IsOptional()
  @Matches(/^[A-Za-z]{2,6}$/, { message: 'ORDER_NUMBER_PREFIX must be 2-6 letters' })
  ORDER_NUMBER_PREFIX?: string;

  /**
   * The AI service is addressed by a configured URL, so it is worth being
   * strict about: this value decides where an uploaded photo is sent.
   */
  @ValidateIf((env: EnvironmentVariables) => Boolean(env.AI_SERVICE_URL))
  @IsUrl({ require_tld: false }, { message: 'AI_SERVICE_URL must be a URL' })
  AI_SERVICE_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1000, { message: 'AI_SERVICE_TIMEOUT_MS must be at least 1000' })
  AI_SERVICE_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'SCAN_RATE_LIMIT must be at least 1' })
  SCAN_RATE_LIMIT?: number;
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

  assertRoutingIsUsable(config);

  return config;
}

/**
 * Delivery fees are charged against a measured distance, so the measurement has
 * to be real. The `estimate` provider multiplies a straight line by a constant —
 * fine for development, dishonest on a receipt — and OSRM without a host
 * configured cannot answer at all. Both are refused at boot in production
 * rather than surfacing later as a wrong charge.
 */
function assertRoutingIsUsable(config: Record<string, unknown>): void {
  if (config.NODE_ENV !== 'production') return;

  const provider = (config.ROUTING_PROVIDER as string | undefined) ?? 'estimate';

  if (provider === 'estimate') {
    throw new Error(
      'ROUTING_PROVIDER=estimate approximates road distance and must not be used in production. ' +
        'Set ROUTING_PROVIDER=osrm and point ROUTING_OSRM_BASE_URL at a routing service.',
    );
  }

  if (provider === 'osrm' && !config.ROUTING_OSRM_BASE_URL) {
    throw new Error('ROUTING_OSRM_BASE_URL is required when ROUTING_PROVIDER=osrm');
  }
}
