import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { DeliveryPricingService } from './delivery-pricing.service';
import { DeliveryPricingRuleDocument } from './schemas';

const STORE = new Types.ObjectId('64b000000000000000000001');
const RULE_ID = '64b0000000000000000000aa';

/** A stand-in rule document, with the `save` a real one would have. */
function ruleDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    _id: new Types.ObjectId(RULE_ID),
    label: 'Nearby',
    minDistanceMeters: 0,
    maxDistanceMeters: 2_000,
    fee: 80,
    priority: 0,
    isActive: true,
    ...overrides,
  };

  return Object.assign(base, {
    save: jest.fn().mockImplementation(function (this: typeof base) {
      return Promise.resolve(this);
    }),
    toObject: jest.fn().mockImplementation(function (this: typeof base) {
      return { ...this };
    }),
  });
}

function chain<T>(value: T) {
  return {
    select: () => chain(value),
    lean: () => chain(value),
    exec: () => Promise.resolve(value),
  };
}

/**
 * ADMIN CONFIGURATION OF THE PRICING ENGINE
 *
 * Section 17 asks for validation that no band is negative, inverted, or
 * ambiguously overlapping another active one. The engine itself is already
 * covered by `delivery-pricing.service.spec.ts`; these are the guards that stop
 * a bad rule set being created in the first place.
 */
describe('DeliveryPricingService — rule configuration', () => {
  let model: Record<string, jest.Mock>;
  let service: DeliveryPricingService;

  beforeEach(() => {
    model = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      deleteOne: jest.fn(),
    };

    service = new DeliveryPricingService(model as unknown as Model<DeliveryPricingRuleDocument>);
  });

  describe('createRule', () => {
    it('creates a band that does not overlap an existing active one', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(ruleDoc({ label: 'Across town' }));

      const rule = await service.createRule(STORE, {
        label: 'Across town',
        minDistanceMeters: 2_000,
        maxDistanceMeters: 5_000,
        fee: 120,
        priority: 0,
        isActive: true,
      });

      expect(rule.label).toBe('Across town');
      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ storeId: STORE }));
    });

    it('refuses a band that overlaps an active one', async () => {
      model.findOne.mockReturnValue(chain({ label: 'Nearby' }));

      await expect(
        service.createRule(STORE, {
          label: 'Overlapping',
          minDistanceMeters: 1_000,
          maxDistanceMeters: 3_000,
          fee: 100,
          priority: 0,
          isActive: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(model.create).not.toHaveBeenCalled();
    });

    it('uses half-open bounds, so a band may start exactly where another ends', async () => {
      // [0, 2000) and [2000, 5000) do not overlap: 2000 m belongs to exactly one
      // of them. The overlap query must not treat the shared bound as a clash.
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(ruleDoc());

      await service.createRule(STORE, {
        label: 'Adjacent',
        minDistanceMeters: 2_000,
        maxDistanceMeters: 5_000,
        fee: 120,
        priority: 0,
        isActive: true,
      });

      expect(model.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          minDistanceMeters: { $lt: 5_000 },
          maxDistanceMeters: { $gt: 2_000 },
        }),
      );
    });

    it('refuses an inverted range before it reaches the database', async () => {
      await expect(
        service.createRule(STORE, {
          label: 'Backwards',
          minDistanceMeters: 5_000,
          maxDistanceMeters: 2_000,
          fee: 120,
          priority: 0,
          isActive: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an empty range, where the band covers nothing', async () => {
      await expect(
        service.createRule(STORE, {
          label: 'Empty',
          minDistanceMeters: 2_000,
          maxDistanceMeters: 2_000,
          fee: 120,
          priority: 0,
          isActive: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not check overlaps for a band created switched off', async () => {
      // An inactive band prices nothing, so it cannot be ambiguous with anything.
      model.create.mockResolvedValue(ruleDoc({ isActive: false }));

      await service.createRule(STORE, {
        label: 'Draft',
        minDistanceMeters: 0,
        maxDistanceMeters: 3_000,
        fee: 90,
        priority: 0,
        isActive: false,
      });

      expect(model.findOne).not.toHaveBeenCalled();
    });
  });

  describe('updateRule', () => {
    it('scopes the load by store, so an admin cannot edit another store’s rule by id', async () => {
      model.findOne.mockReturnValue(chain(null));

      await expect(service.updateRule(STORE, RULE_ID, { fee: 150 })).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(model.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE, _id: new Types.ObjectId(RULE_ID) }),
      );
    });

    it('merges the change onto the existing rule rather than replacing it', async () => {
      const existing = ruleDoc();
      model.findOne
        .mockReturnValueOnce({ exec: () => Promise.resolve(existing) })
        .mockReturnValue(chain(null));

      const rule = await service.updateRule(STORE, RULE_ID, { fee: 95 });

      expect(rule.fee).toBe(95);
      // Untouched fields survive: a partial update is not a partial rule.
      expect(rule.minDistanceMeters).toBe(0);
      expect(rule.maxDistanceMeters).toBe(2_000);
      expect(rule.label).toBe('Nearby');
    });

    it('excludes the rule being edited from its own overlap check', async () => {
      const existing = ruleDoc();
      model.findOne
        .mockReturnValueOnce({ exec: () => Promise.resolve(existing) })
        .mockReturnValue(chain(null));

      await service.updateRule(STORE, RULE_ID, { fee: 95 });

      expect(model.findOne).toHaveBeenLastCalledWith(
        expect.objectContaining({ _id: { $ne: existing._id } }),
      );
    });

    it('rejects a bad id as not found rather than throwing a cast error', async () => {
      await expect(service.updateRule(STORE, 'not-an-id', { fee: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteRule', () => {
    it('deletes a rule when others remain active', async () => {
      model.findOne.mockReturnValue({ exec: () => Promise.resolve(ruleDoc()) });
      model.countDocuments.mockResolvedValue(3);
      model.deleteOne.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) });

      await expect(service.deleteRule(STORE, RULE_ID)).resolves.toEqual({
        deleted: true,
        id: RULE_ID,
      });
    });

    it('refuses to delete the last active rule', async () => {
      // A store with no bands cannot price a delivery at all, and finding that
      // out at a shopper's checkout is not an acceptable way to discover it.
      model.findOne.mockReturnValue({ exec: () => Promise.resolve(ruleDoc()) });
      model.countDocuments.mockResolvedValue(0);

      await expect(service.deleteRule(STORE, RULE_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(model.deleteOne).not.toHaveBeenCalled();
    });

    it('allows deleting an inactive rule even when it is the only one left', async () => {
      model.findOne.mockReturnValue({ exec: () => Promise.resolve(ruleDoc({ isActive: false })) });
      model.deleteOne.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 1 }) });

      await expect(service.deleteRule(STORE, RULE_ID)).resolves.toMatchObject({ deleted: true });
      expect(model.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe('listRules', () => {
    it('reports the problems in the set beside the rules themselves', async () => {
      model.find.mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: () => ({
              exec: () =>
                Promise.resolve([
                  { ...ruleDoc(), isActive: true },
                  {
                    ...ruleDoc({
                      _id: new Types.ObjectId('64b0000000000000000000bb'),
                      label: 'Far',
                      minDistanceMeters: 5_000,
                      maxDistanceMeters: 8_000,
                    }),
                    isActive: true,
                  },
                ]),
            }),
          }),
        }),
      });

      const { rules, problems } = await service.listRules(STORE, 12_000);

      expect(rules).toHaveLength(2);
      // 2000-5000 m is uncovered, and pricing stops 4 km short of the radius.
      expect(problems.map((problem) => problem.kind)).toEqual(['GAP', 'GAP']);
    });
  });
});
