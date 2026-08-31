import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException } from 'src/common/errors';
import {
  Coordinates,
  ROUTING_PROVIDER,
  RouteResult,
  RoutingProvider,
  RoutingUnavailableError,
} from './routing.provider';

/**
 * The application's entry point to routing.
 *
 * Business code depends on this, never on a provider. Two things live here that
 * do not belong in any single provider:
 *
 *   1. The production honesty rule — an approximating provider may not price a
 *      real delivery, so a request for one is refused rather than answered with
 *      a plausible-looking number.
 *   2. Translation of transport failures into the application's error contract,
 *      so callers handle one exception type.
 *
 * Cost control is deliberately *not* here. Routing is called once per checkout
 * preview and once at order creation, from code paths the shopper explicitly
 * triggers — never on address keystrokes. A cache keyed on a coordinate pair
 * would add staleness and a cache-invalidation problem to save a request that
 * is already rare.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Inject(ROUTING_PROVIDER) private readonly provider: RoutingProvider,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /** Which implementation is answering, for the delivery snapshot and diagnostics. */
  get providerName(): string {
    return this.provider.name;
  }

  /** True when distances are real road distances rather than approximations. */
  get isRoadAccurate(): boolean {
    return this.provider.isRoadAccurate;
  }

  async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    this.assertProviderIsAcceptable();

    try {
      const route = await this.provider.calculateRoute(origin, destination);

      if (!Number.isFinite(route.distanceMeters) || route.distanceMeters < 0) {
        throw new RoutingUnavailableError('Routing returned an implausible distance');
      }

      return route;
    } catch (error) {
      if (error instanceof RoutingUnavailableError) {
        this.logger.warn('Routing unavailable via ' + this.provider.name + ': ' + error.message);
        throw BusinessException.routingUnavailable();
      }

      throw error;
    }
  }

  /**
   * Belt to env.validation's braces.
   *
   * Configuration is checked at boot, but a deployment could be reconfigured at
   * runtime, and the consequence of getting this wrong is charging a real
   * shopper a fee derived from a made-up distance. Refusing at the point of use
   * costs one comparison.
   */
  private assertProviderIsAcceptable(): void {
    const isProduction = this.configService.get('isProduction', { infer: true });

    if (isProduction && !this.provider.isRoadAccurate) {
      this.logger.error(
        'Routing provider "' +
          this.provider.name +
          '" only approximates road distance and cannot be used to price deliveries in production',
      );
      throw BusinessException.routingUnavailable();
    }
  }
}
