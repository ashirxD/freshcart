import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException } from 'src/common/errors';
import { DeliveryPricingService } from './delivery-pricing.service';
import { Coordinates, RoutingService } from './routing';

/**
 * A priced, serviceable delivery. Everything an order needs to snapshot.
 */
export interface DeliveryQuote {
  distanceMeters: number;
  durationSeconds: number | null;
  fee: number;
  pricingRuleId: string;
  pricingRuleLabel: string;
  routingProvider: string;
  calculatedAt: Date;
}

/**
 * Composes the three questions a delivery raises, in the only order that makes
 * sense: how far is it, is that within the area we serve, and what does that
 * distance cost.
 *
 * The service-area limit is read from configuration, so the number 12,000 does
 * not appear in business logic, in a controller, or in the UI. Pricing is
 * delegated wholesale to {@link DeliveryPricingService} — this class knows that
 * a fee exists, not how it is calculated.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly routingService: RoutingService,
    private readonly pricingService: DeliveryPricingService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /** The configured service radius, in metres. Surfaced so the UI can explain it. */
  get maxDistanceMeters(): number {
    return this.configService.get('delivery', { infer: true }).maxDistanceMeters;
  }

  /**
   * Measures, checks serviceability, and prices — in that order, because each
   * step is only meaningful if the one before it succeeded.
   *
   * Called once when the shopper opens the checkout preview and once again when
   * they place the order. Never on address input: routing providers can charge
   * per request, and a quote for a half-typed address means nothing anyway.
   */
  async quote(params: {
    storeId: Types.ObjectId;
    origin: Coordinates;
    destination: Coordinates;
  }): Promise<DeliveryQuote> {
    const route = await this.routingService.calculateRoute(params.origin, params.destination);

    this.assertWithinServiceArea(route.distanceMeters);

    const priced = await this.pricingService.priceFor(params.storeId, route.distanceMeters);

    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      fee: priced.fee,
      pricingRuleId: priced.ruleId,
      pricingRuleLabel: priced.ruleLabel,
      routingProvider: route.provider,
      calculatedAt: new Date(),
    };
  }

  /**
   * Refuses an address outside the service radius with the numbers that explain
   * why, so the UI can say "that is 14.2 km away; we deliver up to 12 km"
   * rather than a bare refusal.
   */
  private assertWithinServiceArea(distanceMeters: number): void {
    const limit = this.maxDistanceMeters;

    if (distanceMeters > limit) {
      throw BusinessException.deliveryUnavailable(
        'That address is outside our delivery area. You can still collect this order from the store.',
        {
          distanceMeters: Math.round(distanceMeters),
          maxDistanceMeters: limit,
        },
      );
    }
  }
}
