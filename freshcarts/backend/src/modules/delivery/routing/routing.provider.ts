/**
 * ROUTING ABSTRACTION
 *
 * Business logic asks one question — "how far, and how long, from here to
 * there?" — and must not know who answers it. Everything provider-specific
 * (URL shapes, coordinate ordering, rate limits, response parsing) lives behind
 * this interface, so swapping OSRM for Google, Mapbox or a self-hosted engine
 * is a new class and one environment variable, not a change to delivery
 * pricing, checkout or orders.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  /** Road distance, metres. Integer — it feeds an integer fee lookup. */
  distanceMeters: number;
  /**
   * Estimated travel time in seconds, when the provider supplies one.
   * Optional because not every provider does, and an invented number would
   * become an invented delivery estimate on a shopper's screen.
   */
  durationSeconds: number | null;
  /** Which implementation produced this, recorded on the order snapshot. */
  provider: string;
}

/** Raised when the provider cannot answer. Never a wrong distance. */
export class RoutingUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RoutingUnavailableError';
  }
}

export interface RoutingProvider {
  /** Stable identifier persisted on delivery snapshots. */
  readonly name: string;

  /**
   * True when this provider measures real road distance.
   *
   * The development provider returns false, which is what lets the application
   * refuse to charge an approximated distance in production rather than relying
   * on someone remembering the configuration.
   */
  readonly isRoadAccurate: boolean;

  calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult>;
}

/** Injection token — an interface cannot be one at runtime. */
export const ROUTING_PROVIDER = Symbol('ROUTING_PROVIDER');

/**
 * Great-circle distance in metres.
 *
 * Shared by the estimate provider and by input sanity checks. It is never the
 * authoritative delivery distance: roads are not straight lines, and a fee
 * derived from a straight line undercharges every single delivery.
 */
export function haversineMeters(origin: Coordinates, destination: Coordinates): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLon = toRadians(destination.longitude - origin.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(deltaLon / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
