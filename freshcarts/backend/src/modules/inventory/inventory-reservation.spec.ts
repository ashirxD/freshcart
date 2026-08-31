import { Model, Types } from 'mongoose';
import { StoresService } from 'src/modules/stores';
import { InventoryService } from './inventory.service';
import { InventoryAdjustmentDocument, InventoryDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const PRODUCT_ID = new Types.ObjectId('64b000000000000000000101');

/**
 * A stand-in for MongoDB's per-document atomicity.
 *
 * Holds a quantity and applies `findOneAndUpdate` the way the server does:
 * the filter is evaluated and the update applied as one indivisible step, with
 * no opportunity for another caller to interleave between them. Two concurrent
 * `tryReserve` calls against this therefore behave exactly as they would
 * against a real deployment — which is what makes the oversell test meaningful
 * rather than a mock echoing back what it was told.
 */
function atomicInventory(initialQuantity: number) {
  let quantity = initialQuantity;

  return {
    get quantity() {
      return quantity;
    },
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const guard = filter.quantity as { $gte?: number } | undefined;
        const increment = (update.$inc as { quantity: number } | undefined)?.quantity ?? 0;

        const matches = guard?.$gte === undefined || quantity >= guard.$gte;

        if (!matches) return { exec: () => Promise.resolve(null) };

        quantity += increment;
        return { exec: () => Promise.resolve({ quantity, lowStockThreshold: 5 }) };
      },
    ),
    updateOne: jest.fn((_filter: unknown, update: Record<string, unknown>) => {
      quantity += (update.$inc as { quantity: number }).quantity;
      return { exec: () => Promise.resolve({ acknowledged: true }) };
    }),
  };
}

describe('InventoryService — reservation', () => {
  let store: ReturnType<typeof atomicInventory>;
  let service: InventoryService;

  const build = (initialQuantity: number) => {
    store = atomicInventory(initialQuantity);
    service = new InventoryService(
      store as unknown as Model<InventoryDocument>,
      // Reservation never writes an audit row: order stock movements are already
      // reconstructible from the order's own history.
      { create: jest.fn() } as unknown as Model<InventoryAdjustmentDocument>,
      { getActiveStoreObjectId: jest.fn() } as unknown as StoresService,
    );
  };

  describe('tryReserve', () => {
    it('puts the stock check inside the update filter, never in application code', async () => {
      build(10);

      await service.tryReserve(PRODUCT_ID, STORE_ID, 3);

      // This assertion is the whole point: the guard travels to the database as
      // part of the write. Hoisting it into an `if` above the update is exactly
      // the read-then-write race that oversells the last item.
      expect(store.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: PRODUCT_ID, storeId: STORE_ID, quantity: { $gte: 3 } },
        { $inc: { quantity: -3 } },
        expect.objectContaining({ new: true }),
      );
    });

    it('takes the stock and reports success', async () => {
      build(10);

      await expect(service.tryReserve(PRODUCT_ID, STORE_ID, 3)).resolves.toBe(true);
      expect(store.quantity).toBe(7);
    });

    it('takes exactly the last unit', async () => {
      build(1);

      await expect(service.tryReserve(PRODUCT_ID, STORE_ID, 1)).resolves.toBe(true);
      expect(store.quantity).toBe(0);
    });

    it('refuses, and changes nothing, when there is not enough', async () => {
      build(2);

      await expect(service.tryReserve(PRODUCT_ID, STORE_ID, 5)).resolves.toBe(false);
      expect(store.quantity).toBe(2);
    });

    it('refuses against an empty shelf', async () => {
      build(0);

      await expect(service.tryReserve(PRODUCT_ID, STORE_ID, 1)).resolves.toBe(false);
      expect(store.quantity).toBe(0);
    });

    it('lets exactly one of two shoppers take the last packet', async () => {
      // The scenario §11 describes. Both calls are launched before either
      // resolves, so if the check and the decrement were separate steps both
      // would see quantity 1 and both would succeed.
      build(1);

      const [first, second] = await Promise.all([
        service.tryReserve(PRODUCT_ID, STORE_ID, 1),
        service.tryReserve(PRODUCT_ID, STORE_ID, 1),
      ]);

      expect([first, second].filter(Boolean)).toHaveLength(1);
      // Never negative: the shelf cannot go into debt.
      expect(store.quantity).toBe(0);
    });

    it('never oversells under heavier contention', async () => {
      build(5);

      const attempts = await Promise.all(
        Array.from({ length: 20 }, () => service.tryReserve(PRODUCT_ID, STORE_ID, 1)),
      );

      expect(attempts.filter(Boolean)).toHaveLength(5);
      expect(store.quantity).toBe(0);
    });

    it('never oversells with mixed basket sizes', async () => {
      build(10);

      const results = await Promise.all([
        service.tryReserve(PRODUCT_ID, STORE_ID, 6),
        service.tryReserve(PRODUCT_ID, STORE_ID, 6),
        service.tryReserve(PRODUCT_ID, STORE_ID, 4),
      ]);

      expect(store.quantity).toBeGreaterThanOrEqual(0);
      // Whatever combination wins, the units taken can never exceed what existed.
      const taken = 10 - store.quantity;
      expect(taken).toBeLessThanOrEqual(10);
      expect(results.some(Boolean)).toBe(true);
    });
  });

  describe('release', () => {
    it('returns stock unconditionally — a return must never fail on a guard', async () => {
      build(0);

      await service.release(PRODUCT_ID, STORE_ID, 3);

      expect(store.quantity).toBe(3);
      expect(store.updateOne).toHaveBeenCalledWith(
        { productId: PRODUCT_ID, storeId: STORE_ID },
        { $inc: { quantity: 3 } },
        expect.anything(),
      );
    });

    it('round-trips a reservation exactly', async () => {
      build(10);

      await service.tryReserve(PRODUCT_ID, STORE_ID, 4);
      expect(store.quantity).toBe(6);

      await service.release(PRODUCT_ID, STORE_ID, 4);
      expect(store.quantity).toBe(10);
    });
  });
});
