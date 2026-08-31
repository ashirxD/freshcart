import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { DeliveryPricingService } from './delivery-pricing.service';
import { DeliveryService } from './delivery.service';
import {
  EstimateRoutingProvider,
  OsrmRoutingProvider,
  ROUTING_PROVIDER,
  RoutingProvider,
  RoutingService,
} from './routing';
import { DeliveryPricingRule, DeliveryPricingRuleSchema } from './schemas';

/**
 * Delivery: distance, service area and pricing.
 *
 * The routing provider is chosen once, here, from configuration. Everything
 * downstream is injected with the {@link ROUTING_PROVIDER} token and never
 * learns which implementation it received — that is what keeps a provider swap
 * to this factory plus an environment variable.
 *
 * No controller: nothing in this milestone exposes delivery directly. Quotes
 * reach the client through the checkout preview, where they belong beside the
 * items and totals they are part of.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryPricingRule.name, schema: DeliveryPricingRuleSchema },
    ]),
  ],
  providers: [
    {
      provide: ROUTING_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>): RoutingProvider => {
        const routing = configService.get('routing', { infer: true });

        return routing.provider === 'osrm'
          ? new OsrmRoutingProvider(routing.osrmBaseUrl, routing.timeoutMs)
          : new EstimateRoutingProvider(routing.estimateRoadFactor, routing.estimateSpeedKph);
      },
    },
    RoutingService,
    DeliveryPricingService,
    DeliveryService,
  ],
  exports: [DeliveryService, DeliveryPricingService, RoutingService, MongooseModule],
})
export class DeliveryModule {}
