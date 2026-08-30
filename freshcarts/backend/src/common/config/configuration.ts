/**
 * Typed application configuration, loaded once at bootstrap.
 * Every value the app needs is read from here — never from `process.env` directly
 * outside this file, so configuration stays testable and auditable.
 */
/**
 * A JWT lifetime such as "15m" or "7d". Typed as a template literal rather than
 * `string` so token lifetimes stay assignable to the signing options and a typo
 * like "15 minutes" is caught at compile time.
 */
export type JwtDuration = `${number}s` | `${number}m` | `${number}h` | `${number}d`;

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  database: { uri: string };
  jwt: {
    accessSecret: string;
    accessExpiresIn: JwtDuration;
    refreshSecret: string;
    refreshExpiresIn: JwtDuration;
  };
  security: { bcryptSaltRounds: number };
  /** Which store the customer catalogue is scoped to. Unset -> oldest active store. */
  store: { defaultSlug?: string };
  cookie: { secure: boolean; domain?: string; sameSite: 'lax' | 'strict' | 'none' };
  throttle: { ttl: number; limit: number };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
};

export default (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: toInt(process.env.PORT, 4000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: {
      uri: process.env.MONGODB_URI as string,
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET as string,
      // Shape is enforced by env validation; this is the one boundary cast.
      accessExpiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as JwtDuration,
      refreshSecret: process.env.JWT_REFRESH_SECRET as string,
      refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as JwtDuration,
    },
    security: {
      bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 12),
    },
    store: {
      defaultSlug: process.env.DEFAULT_STORE_SLUG || undefined,
    },
    cookie: {
      secure: toBool(process.env.COOKIE_SECURE, nodeEnv === 'production'),
      domain: process.env.COOKIE_DOMAIN || undefined,
      sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
    },
    throttle: {
      ttl: toInt(process.env.THROTTLE_TTL, 60_000),
      limit: toInt(process.env.THROTTLE_LIMIT, 120),
    },
  };
};
