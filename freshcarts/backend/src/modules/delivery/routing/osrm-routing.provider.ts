import { Injectable, Logger } from '@nestjs/common';
import {
  Coordinates,
  RouteResult,
  RoutingProvider,
  RoutingUnavailableError,
} from './routing.provider';

/** The subset of an OSRM `/route` response this provider relies on. */
interface OsrmRouteResponse {
  code?: string;
  routes?: Array<{ distance?: number; duration?: number }>;
}

/**
 * Road routing against an OSRM-compatible service.
 *
 * OSRM is the default because it is open source and self-hostable: the
 * production deployment can run its own instance with no per-request cost and
 * no customer coordinates leaving the platform. The public demo server is fine
 * for staging but is explicitly not for production traffic.
 *
 * Everything OSRM-specific stops here — the `lon,lat` ordering, the
 * `/route/v1/driving` path shape, the `code: "Ok"` convention. A Google or
 * Mapbox provider would implement the same two-method interface and nothing
 * else in the application would change.
 */
@Injectable()
export class OsrmRoutingProvider implements RoutingProvider {
  private readonly logger = new Logger(OsrmRoutingProvider.name);

  readonly name = 'osrm';
  readonly isRoadAccurate = true;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    if (!this.baseUrl) {
      throw new RoutingUnavailableError('No routing service is configured');
    }

    // OSRM takes coordinates as lon,lat — the opposite of how humans write them.
    const path =
      '/route/v1/driving/' +
      origin.longitude +
      ',' +
      origin.latitude +
      ';' +
      destination.longitude +
      ',' +
      destination.latitude +
      '?overview=false&alternatives=false&steps=false';

    // An unbounded routing call would hold a checkout request open indefinitely;
    // failing fast lets the shopper see a real message and retry.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl + path, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new RoutingUnavailableError('Routing service returned ' + response.status);
      }

      const payload = (await response.json()) as OsrmRouteResponse;
      const route = payload.routes?.[0];

      if (payload.code !== 'Ok' || !route || typeof route.distance !== 'number') {
        throw new RoutingUnavailableError('Routing service returned no usable route');
      }

      return {
        distanceMeters: Math.round(route.distance),
        durationSeconds: typeof route.duration === 'number' ? Math.round(route.duration) : null,
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof RoutingUnavailableError) throw error;

      // Coordinates are customer data; the log records the failure, not the pair.
      this.logger.warn(
        'Routing request failed: ' + (error instanceof Error ? error.message : 'unknown error'),
      );

      throw new RoutingUnavailableError('Could not reach the routing service', error);
    } finally {
      clearTimeout(timer);
    }
  }
}
