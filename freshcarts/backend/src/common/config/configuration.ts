/**
 * ENVIRONMENT configuration, loaded once at bootstrap.
 *
 * Every value the app needs from the environment is read here — never from
 * `process.env` directly outside this file, so configuration stays testable and
 * auditable.
 *
 * Section 25 draws a line this file sits on one side of. What belongs here
 * answers "where does this process find its dependencies, and how is it
 * deployed?": connection strings, secrets, ports, provider choices, timeouts.
 *
 * What does NOT belong here is business configuration — the delivery radius,
 * the default low-stock threshold, the support number. Those are decisions an
 * operator makes, not a deployer, and changing one must not require a redeploy.
 * They live in the `platform_settings` document and are read through
 * SettingsService. Adding a business rule to this file is the mistake that
 * section 25 names.
 */
/**
 * A JWT lifetime such as "15m" or "7d". Typed as a template literal rather than
 * `string` so token lifetimes stay assignable to the signing options and a typo
 * like "15 minutes" is caught at compile time.
 */
export type JwtDuration = `${number}s` | `${number}m` | `${number}h` | `${number}d`;

/** Which implementation answers "how far is it by road?". */
export type RoutingProviderName = 'osrm' | 'estimate';

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
  store: {
    defaultSlug?: string;
    /**
     * Minutes ahead of UTC for store-local time. Opening hours are stored as
     * wall-clock strings ("08:00"), and the server may run anywhere, so
     * "is the store open?" needs an offset to be answerable at all.
     * Defaults to +05:00 — Pakistan Standard Time, which has no DST.
     */
    timezoneOffsetMinutes: number;
  };
  cookie: { secure: boolean; domain?: string; sameSite: 'lax' | 'strict' | 'none' };
  throttle: { ttl: number; limit: number };
  routing: {
    provider: RoutingProviderName;
    /** OSRM-compatible routing host. Self-hostable; no API key involved. */
    osrmBaseUrl: string;
    timeoutMs: number;
    /**
     * Straight-line to road-distance multiplier used by the `estimate`
     * provider only. Roads do not run in straight lines; 1.0 would understate
     * every distance and therefore undercharge every delivery.
     */
    estimateRoadFactor: number;
    /** Average road speed, for the `estimate` provider's duration figure. */
    estimateSpeedKph: number;
  };
  orders: {
    /** Leading segment of the customer-facing order number, e.g. "FC". */
    numberPrefix: string;
  };
  payments: {
    /** Methods the API will actually accept. Enum membership alone is not enough. */
    enabledMethods: string[];
  };
  idempotency: {
    /** How long a completed order-creation key stays replayable. */
    ttlSeconds: number;
  };
  /**
   * The Python AI service that reads grocery-list photos.
   *
   * It is an internal dependency: FreshCarts works fully without it, and only
   * the scanner degrades when it is down (section 37).
   */
  ai: {
    /** Base URL of the FastAPI service. Private network only in production. */
    baseUrl: string;
    /** Hard ceiling on one OCR call. Never unbounded (section 36). */
    timeoutMs: number;
    /**
     * Retries for a request that never reached the service. Zero disables
     * them. Only connection failures are retried - a request that WAS
     * delivered is never repeated, because OCR is expensive and a second
     * attempt would cost real work for the same answer.
     */
    connectRetries: number;
    /** Turns the feature off entirely, without removing the deployment. */
    enabled: boolean;
  };
  scan: {
    /** Refused above this, before the bytes leave this process. */
    maxImageBytes: number;
    /** Scans allowed per shopper per window. OCR is expensive (section 41). */
    rateLimit: number;
    rateLimitTtlMs: number;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
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
      timezoneOffsetMinutes: toInt(process.env.STORE_TIMEZONE_OFFSET_MINUTES, 300),
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
    routing: {
      // Development defaults to the estimate provider so the flow works with no
      // external service; env.validation refuses that combination in production.
      provider: (process.env.ROUTING_PROVIDER ?? 'estimate') as RoutingProviderName,
      osrmBaseUrl: (process.env.ROUTING_OSRM_BASE_URL ?? '').replace(/\/+$/, ''),
      timeoutMs: toInt(process.env.ROUTING_TIMEOUT_MS, 4_000),
      estimateRoadFactor: toFloat(process.env.ROUTING_ESTIMATE_ROAD_FACTOR, 1.35),
      estimateSpeedKph: toFloat(process.env.ROUTING_ESTIMATE_SPEED_KPH, 22),
    },
    orders: {
      numberPrefix: (process.env.ORDER_NUMBER_PREFIX ?? 'FC').toUpperCase(),
    },
    payments: {
      enabledMethods: (process.env.PAYMENT_METHODS_ENABLED ?? 'CASH_ON_DELIVERY')
        .split(',')
        .map((method) => method.trim().toUpperCase())
        .filter(Boolean),
    },
    idempotency: {
      ttlSeconds: toInt(process.env.IDEMPOTENCY_TTL_SECONDS, 86_400),
    },
    ai: {
      baseUrl: (process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, ''),
      timeoutMs: toInt(process.env.AI_SERVICE_TIMEOUT_MS, 25_000),
      connectRetries: toInt(process.env.AI_SERVICE_CONNECT_RETRIES, 1),
      enabled: toBool(process.env.AI_SERVICE_ENABLED, true),
    },
    scan: {
      maxImageBytes: toInt(process.env.SCAN_MAX_IMAGE_BYTES, 8 * 1024 * 1024),
      rateLimit: toInt(process.env.SCAN_RATE_LIMIT, 10),
      rateLimitTtlMs: toInt(process.env.SCAN_RATE_LIMIT_TTL_MS, 300_000),
    },
  };
};
