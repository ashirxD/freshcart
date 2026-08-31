import { Injectable } from '@nestjs/common';
import { Coordinates, RouteResult, RoutingProvider, haversineMeters } from './routing.provider';

/**
 * Development routing.
 *
 * Multiplies the straight-line distance by a road factor and divides by an
 * average city speed. It is an approximation and says so: `isRoadAccurate` is
 * false, and `assertRoutingIsUsable` in env.validation refuses to boot
 * production with this provider selected. That combination is what keeps
 * "development-safe behaviour" from quietly becoming "production behaviour".
 *
 * Its purpose is that the entire checkout flow — distance, fee, snapshot,
 * out-of-area refusal — is exercisable on a laptop with no external service,
 * no API key and no network.
 */
@Injectable()
export class EstimateRoutingProvider implements RoutingProvider {
  readonly name = 'estimate';
  readonly isRoadAccurate = false;

  constructor(
    private readonly roadFactor: number,
    private readonly averageSpeedKph: number,
  ) {}

  async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    const straightLine = haversineMeters(origin, destination);
    const distanceMeters = Math.round(straightLine * this.roadFactor);

    // Metres per second from km/h, then seconds for the distance.
    const metresPerSecond = (this.averageSpeedKph * 1000) / 3600;
    const durationSeconds =
      metresPerSecond > 0 ? Math.round(distanceMeters / metresPerSecond) : null;

    return { distanceMeters, durationSeconds, provider: this.name };
  }
}
