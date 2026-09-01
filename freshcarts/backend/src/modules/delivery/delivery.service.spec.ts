import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException, ErrorCode } from 'src/common/errors';
import { SettingsService } from 'src/modules/settings';
import { DeliveryPricingService } from './delivery-pricing.service';
import { DeliveryService } from './delivery.service';
import { EstimateRoutingProvider } from './routing';
import { RoutingService } from './routing';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');

/** Gulberg III, Lahore — the seeded store. */
const STORE_LOCATION = { latitude: 31.5102, longitude: 74.3441 };

describe('DeliveryService', () => {
  let routingService: { calculateRoute: jest.Mock };
  let pricingService: { priceFor: jest.Mock };
  let service: DeliveryService;

  // The service radius is business configuration now, so the double answers the
  // one question DeliveryService asks of settings.
  const settingsService = {
    maxDeliveryDistanceMeters: jest.fn().mockResolvedValue(12_000),
  } as unknown as SettingsService;

  beforeEach(() => {
    routingService = { calculateRoute: jest.fn() };
    pricingService = { priceFor: jest.fn() };

    service = new DeliveryService(
      routingService as unknown as RoutingService,
      pricingService as unknown as DeliveryPricingService,
      settingsService,
    );
  });

  it('measures, then prices, and snapshots both', async () => {
    routingService.calculateRoute.mockResolvedValue({
      distanceMeters: 4_300,
      durationSeconds: 900,
      provider: 'osrm',
    });
    pricingService.priceFor.mockResolvedValue({ fee: 120, ruleId: 'r2', ruleLabel: 'Short' });

    const quote = await service.quote({
      storeId: STORE_ID,
      origin: STORE_LOCATION,
      destination: { latitude: 31.545, longitude: 74.372 },
    });

    expect(quote).toMatchObject({
      distanceMeters: 4_300,
      durationSeconds: 900,
      fee: 120,
      pricingRuleId: 'r2',
      routingProvider: 'osrm',
    });
    expect(quote.calculatedAt).toBeInstanceOf(Date);

    // The fee is priced against the measured distance, not the other way round.
    expect(pricingService.priceFor).toHaveBeenCalledWith(STORE_ID, 4_300);
  });

  it('refuses an address beyond the service radius, and says by how much', async () => {
    routingService.calculateRoute.mockResolvedValue({
      distanceMeters: 14_200,
      durationSeconds: 2_100,
      provider: 'osrm',
    });

    try {
      await service.quote({
        storeId: STORE_ID,
        origin: STORE_LOCATION,
        destination: { latitude: 31.7, longitude: 74.5 },
      });
      fail('expected delivery to be refused');
    } catch (error) {
      const failure = error as BusinessException;
      expect(failure.code).toBe(ErrorCode.DELIVERY_UNAVAILABLE);
      // The numbers the UI needs to explain the refusal without hardcoding 12km.
      expect(failure.details).toEqual({ distanceMeters: 14_200, maxDistanceMeters: 12_000 });
    }

    // Nothing outside the area is ever priced.
    expect(pricingService.priceFor).not.toHaveBeenCalled();
  });

  it('treats the service radius as inclusive at exactly the limit', async () => {
    routingService.calculateRoute.mockResolvedValue({
      distanceMeters: 12_000,
      durationSeconds: null,
      provider: 'osrm',
    });
    pricingService.priceFor.mockResolvedValue({ fee: 250, ruleId: 'r4', ruleLabel: 'Long' });

    await expect(
      service.quote({
        storeId: STORE_ID,
        origin: STORE_LOCATION,
        destination: { latitude: 31.6, longitude: 74.4 },
      }),
    ).resolves.toMatchObject({ fee: 250 });
  });

  it('carries a routing failure straight through — it never guesses a distance', async () => {
    routingService.calculateRoute.mockRejectedValue(BusinessException.routingUnavailable());

    await expect(
      service.quote({
        storeId: STORE_ID,
        origin: STORE_LOCATION,
        destination: { latitude: 31.545, longitude: 74.372 },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.ROUTING_UNAVAILABLE });

    expect(pricingService.priceFor).not.toHaveBeenCalled();
  });

  it('exposes the configured radius so the UI need not hardcode it', async () => {
    await expect(service.maxDistanceMeters()).resolves.toBe(12_000);
  });
});

describe('EstimateRoutingProvider', () => {
  const provider = new EstimateRoutingProvider(1.35, 22);

  it('declares itself unfit for production pricing', () => {
    // The flag RoutingService and env validation both act on.
    expect(provider.isRoadAccurate).toBe(false);
  });

  it('returns a road-adjusted distance, never the straight line', async () => {
    const route = await provider.calculateRoute(STORE_LOCATION, {
      latitude: 31.545,
      longitude: 74.372,
    });

    // Straight line between these points is roughly 4.7 km; x1.35 is ~6.3 km.
    expect(route.distanceMeters).toBeGreaterThan(5_500);
    expect(route.distanceMeters).toBeLessThan(7_000);
    expect(Number.isInteger(route.distanceMeters)).toBe(true);
  });

  it('returns zero distance for the same point', async () => {
    const route = await provider.calculateRoute(STORE_LOCATION, STORE_LOCATION);
    expect(route.distanceMeters).toBe(0);
  });

  it('derives a duration from the configured speed', async () => {
    const route = await provider.calculateRoute(STORE_LOCATION, {
      latitude: 31.545,
      longitude: 74.372,
    });

    expect(route.durationSeconds).toBeGreaterThan(0);
  });
});

describe('RoutingService production guard', () => {
  it('refuses to price a delivery with an approximating provider in production', async () => {
    const productionConfig = {
      get: () => true,
    } as unknown as ConfigService<AppConfig, true>;

    const service = new RoutingService(new EstimateRoutingProvider(1.35, 22), productionConfig);

    // §22: "Do not fake road distance in production." Enforced at the point of
    // use as well as at boot, because the consequence is a real charge.
    await expect(
      service.calculateRoute(STORE_LOCATION, { latitude: 31.545, longitude: 74.372 }),
    ).rejects.toMatchObject({ code: ErrorCode.ROUTING_UNAVAILABLE });
  });

  it('allows the same provider outside production', async () => {
    const devConfig = { get: () => false } as unknown as ConfigService<AppConfig, true>;
    const service = new RoutingService(new EstimateRoutingProvider(1.35, 22), devConfig);

    await expect(
      service.calculateRoute(STORE_LOCATION, { latitude: 31.545, longitude: 74.372 }),
    ).resolves.toMatchObject({ provider: 'estimate' });
  });
});
