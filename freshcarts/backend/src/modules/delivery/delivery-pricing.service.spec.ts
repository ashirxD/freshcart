import { Model, Types } from 'mongoose';
import { ErrorCode } from 'src/common/errors';
import { BusinessException } from 'src/common/errors';
import { DeliveryPricingService, PricingBand } from './delivery-pricing.service';
import { DeliveryPricingRuleDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');

/** The seeded development bands: [0,2k) 80, [2k,5k) 120, [5k,8k) 180, [8k,12k) 250. */
function standardBands(): PricingBand[] {
  return [
    {
      id: 'r1',
      label: 'Nearby',
      minDistanceMeters: 0,
      maxDistanceMeters: 2_000,
      fee: 80,
      priority: 0,
    },
    {
      id: 'r2',
      label: 'Short',
      minDistanceMeters: 2_000,
      maxDistanceMeters: 5_000,
      fee: 120,
      priority: 0,
    },
    {
      id: 'r3',
      label: 'Medium',
      minDistanceMeters: 5_000,
      maxDistanceMeters: 8_000,
      fee: 180,
      priority: 0,
    },
    {
      id: 'r4',
      label: 'Long',
      minDistanceMeters: 8_000,
      maxDistanceMeters: 12_000,
      fee: 250,
      priority: 0,
    },
  ];
}

describe('DeliveryPricingService', () => {
  describe('selectBand — boundaries', () => {
    const bands = standardBands();
    const feeAt = (metres: number) => DeliveryPricingService.selectBand(bands, metres)?.fee ?? null;

    it('prices a zero distance — the shopper who lives above the shop', () => {
      expect(feeAt(0)).toBe(80);
    });

    it('prices just below a boundary in the lower band', () => {
      expect(feeAt(1_999)).toBe(80);
    });

    it('prices exactly on a boundary in the UPPER band', () => {
      // Half-open [min, max) is what makes this unambiguous: 2000 belongs to
      // exactly one band, and the answer does not depend on evaluation order.
      expect(feeAt(2_000)).toBe(120);
      expect(feeAt(5_000)).toBe(180);
      expect(feeAt(8_000)).toBe(250);
    });

    it('prices just above a boundary in the upper band', () => {
      expect(feeAt(2_001)).toBe(120);
    });

    it('matches nothing beyond the furthest band', () => {
      expect(DeliveryPricingService.selectBand(bands, 12_000)).toBeNull();
      expect(DeliveryPricingService.selectBand(bands, 20_000)).toBeNull();
    });

    it('resolves an overlapping set deterministically by priority', () => {
      const overlapping: PricingBand[] = [
        ...standardBands(),
        {
          id: 'promo',
          label: 'Promo',
          minDistanceMeters: 0,
          maxDistanceMeters: 5_000,
          fee: 50,
          priority: 10,
        },
      ];

      // Misconfiguration, but it must still price the same way every time
      // rather than depending on which document Mongo returned first.
      expect(DeliveryPricingService.selectBand(overlapping, 1_000)?.fee).toBe(50);
      expect(DeliveryPricingService.selectBand(overlapping, 6_000)?.fee).toBe(180);
    });
  });

  describe('validateRuleSet', () => {
    it('accepts a contiguous set that covers the service area', () => {
      expect(DeliveryPricingService.validateRuleSet(standardBands(), 12_000)).toEqual([]);
    });

    it('reports an empty configuration', () => {
      expect(DeliveryPricingService.validateRuleSet([], 12_000)).toEqual([
        { kind: 'EMPTY', message: expect.any(String) },
      ]);
    });

    it('reports an overlap between two bands', () => {
      const bands = standardBands();
      bands[1].minDistanceMeters = 1_500;

      const problems = DeliveryPricingService.validateRuleSet(bands, 12_000);
      expect(problems.map((problem) => problem.kind)).toContain('OVERLAP');
    });

    it('reports a gap between two bands', () => {
      const bands = standardBands();
      bands[1].minDistanceMeters = 2_500;

      const problems = DeliveryPricingService.validateRuleSet(bands, 12_000);
      expect(problems.map((problem) => problem.kind)).toContain('GAP');
    });

    it('reports a service area that reaches further than pricing does', () => {
      // Raising DELIVERY_MAX_DISTANCE_METERS without adding a band is the
      // realistic way this configuration goes wrong.
      const problems = DeliveryPricingService.validateRuleSet(standardBands(), 20_000);

      expect(problems).toHaveLength(1);
      expect(problems[0].kind).toBe('GAP');
      expect(problems[0].message).toContain('20000');
    });

    it('reports a set that does not start at zero', () => {
      const bands = standardBands().slice(1);
      const problems = DeliveryPricingService.validateRuleSet(bands, 12_000);

      expect(problems.some((problem) => problem.message.includes('0-2000'))).toBe(true);
    });
  });

  describe('priceFor', () => {
    let ruleModel: { find: jest.Mock };
    let service: DeliveryPricingService;

    const stubBands = (bands: PricingBand[]) => {
      ruleModel.find.mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: () => ({
              exec: () =>
                Promise.resolve(
                  bands.map((band) => ({
                    _id: { toString: () => band.id },
                    label: band.label,
                    minDistanceMeters: band.minDistanceMeters,
                    maxDistanceMeters: band.maxDistanceMeters,
                    fee: band.fee,
                    priority: band.priority,
                  })),
                ),
            }),
          }),
        }),
      });
    };

    beforeEach(() => {
      ruleModel = { find: jest.fn() };
      service = new DeliveryPricingService(
        ruleModel as unknown as Model<DeliveryPricingRuleDocument>,
      );
    });

    it('returns the fee and the rule that produced it', async () => {
      stubBands(standardBands());

      await expect(service.priceFor(STORE_ID, 4_300)).resolves.toEqual({
        fee: 120,
        ruleId: 'r2',
        ruleLabel: 'Short',
      });
    });

    it('refuses rather than inventing a fee when nothing is configured', async () => {
      stubBands([]);

      // §26: silently charging an arbitrary amount — or zero, which reads as
      // "free delivery" — is worse than an honest refusal.
      await expect(service.priceFor(STORE_ID, 1_000)).rejects.toMatchObject({
        code: ErrorCode.DELIVERY_PRICING_UNAVAILABLE,
      });
    });

    it('refuses when a gap leaves the distance uncovered', async () => {
      stubBands([standardBands()[0]]);

      await expect(service.priceFor(STORE_ID, 9_000)).rejects.toBeInstanceOf(BusinessException);
    });

    it('refuses a nonsensical distance', async () => {
      stubBands(standardBands());

      await expect(service.priceFor(STORE_ID, -1)).rejects.toBeInstanceOf(BusinessException);
      await expect(service.priceFor(STORE_ID, Number.NaN)).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it('only ever considers active rules', async () => {
      stubBands(standardBands());
      await service.priceFor(STORE_ID, 1_000);

      expect(ruleModel.find).toHaveBeenCalledWith({ storeId: STORE_ID, isActive: true });
    });
  });
});
