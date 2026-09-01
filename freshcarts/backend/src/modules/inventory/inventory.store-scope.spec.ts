import { Model, Types } from 'mongoose';
import { Role, StockStatus } from 'src/common/enums';
import { AuthenticatedUser } from 'src/common/interfaces';
import { StoresService } from 'src/modules/stores';
import { SettingsService } from 'src/modules/settings';
import { InventoryService } from './inventory.service';
import { InventoryAdjustmentDocument, InventoryDocument, StockChangeReason } from './schemas';

const ACTIVE_STORE = new Types.ObjectId('64b000000000000000000001');
const MANAGER_STORE = new Types.ObjectId('64b000000000000000000002');
const PRODUCT_ID = '64b000000000000000000101';

const manager: AuthenticatedUser = {
  userId: '64b00000000000000000000a',
  phone: '+923001234568',
  role: Role.STORE_MANAGER,
  storeId: MANAGER_STORE.toHexString(),
};

type MockModel = Record<string, jest.Mock>;

/**
 * Store scoping and auditing on the inventory service.
 *
 * The behaviour under test is narrow but load-bearing: when a caller supplies a
 * store, that store must reach the query filter — an explicit scope that got
 * dropped somewhere would silently read or write the default store's stock.
 */
describe('InventoryService — store scope and audit', () => {
  let inventoryModel: MockModel;
  let adjustmentModel: MockModel;
  let storesService: jest.Mocked<Pick<StoresService, 'getActiveStoreObjectId'>>;
  let service: InventoryService;

  beforeEach(() => {
    inventoryModel = {
      findOne: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve({ quantity: 12 }) }) }),
        lean: () => ({ exec: () => Promise.resolve({ quantity: 12, lowStockThreshold: 5 }) }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: () => Promise.resolve({ quantity: 20, lowStockThreshold: 5 }),
      }),
      exists: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) }),
    };

    adjustmentModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({
        sort: () => ({
          limit: () => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }) }),
        }),
      }),
    };

    storesService = {
      getActiveStoreObjectId: jest.fn().mockResolvedValue(ACTIVE_STORE),
    } as never;

    service = new InventoryService(
      inventoryModel as unknown as Model<InventoryDocument>,
      adjustmentModel as unknown as Model<InventoryAdjustmentDocument>,
      storesService as unknown as StoresService,
      { defaultLowStockThreshold: jest.fn().mockResolvedValue(5) } as unknown as SettingsService,
    );
  });

  describe('an explicit store scope', () => {
    it('reaches the update filter', async () => {
      await service.update(PRODUCT_ID, { quantity: 20 }, { storeId: MANAGER_STORE });

      const [filter] = inventoryModel.findOneAndUpdate.mock.calls[0];
      expect(filter.storeId).toEqual(MANAGER_STORE);
      expect(storesService.getActiveStoreObjectId).not.toHaveBeenCalled();
    });

    it('reaches the single-product lookup', async () => {
      await service.findForProduct(PRODUCT_ID, MANAGER_STORE);

      expect(inventoryModel.findOne).toHaveBeenCalledWith({
        productId: new Types.ObjectId(PRODUCT_ID),
        storeId: MANAGER_STORE,
      });
    });

    it('reaches the list pipeline', async () => {
      inventoryModel.aggregate.mockReturnValue({
        exec: () => Promise.resolve([{ items: [], total: [] }]),
      });

      await service.list({ page: 1, limit: 20, skip: 0 } as never, MANAGER_STORE);

      const [pipeline] = inventoryModel.aggregate.mock.calls[0];
      expect(pipeline[0].$match).toEqual({ storeId: MANAGER_STORE });
    });

    it('falls back to the active store when omitted', async () => {
      await service.update(PRODUCT_ID, { quantity: 20 });

      const [filter] = inventoryModel.findOneAndUpdate.mock.calls[0];
      expect(filter.storeId).toEqual(ACTIVE_STORE);
    });
  });

  describe('the status filter', () => {
    async function matchStagesFor(status: StockStatus) {
      inventoryModel.aggregate.mockReturnValue({
        exec: () => Promise.resolve([{ items: [], total: [] }]),
      });

      await service.list({ page: 1, limit: 20, skip: 0, status } as never, MANAGER_STORE);

      const [pipeline] = inventoryModel.aggregate.mock.calls[0] as [Array<Record<string, unknown>>];
      return pipeline.filter((stage) => '$match' in stage).map((stage) => stage.$match);
    }

    it('matches sold-out rows on quantity alone', async () => {
      const matches = await matchStagesFor(StockStatus.OUT_OF_STOCK);
      expect(matches).toContainEqual({ quantity: { $lte: 0 } });
    });

    it('excludes sold-out rows from the low-stock band', async () => {
      // Otherwise a product at zero would appear under both alerts, and the two
      // dashboard tiles would double-count it.
      const matches = await matchStagesFor(StockStatus.LOW_STOCK);
      expect(matches).toContainEqual({
        quantity: { $gt: 0 },
        $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
      });
    });

    it('excludes low and sold-out rows from the in-stock band', async () => {
      const matches = await matchStagesFor(StockStatus.IN_STOCK);
      expect(matches).toContainEqual({
        quantity: { $gt: 0 },
        $expr: { $gt: ['$quantity', '$lowStockThreshold'] },
      });
    });
  });

  describe('countByStatus', () => {
    it('buckets the store in one aggregation', async () => {
      inventoryModel.aggregate.mockReturnValue({
        exec: () =>
          Promise.resolve([
            { _id: StockStatus.LOW_STOCK, count: 7 },
            { _id: StockStatus.OUT_OF_STOCK, count: 4 },
          ]),
      });

      const counts = await service.countByStatus(MANAGER_STORE);

      expect(inventoryModel.aggregate).toHaveBeenCalledTimes(1);
      const [pipeline] = inventoryModel.aggregate.mock.calls[0];
      expect(pipeline[0].$match).toEqual({ storeId: MANAGER_STORE });
      expect(counts).toEqual({ IN_STOCK: 0, LOW_STOCK: 7, OUT_OF_STOCK: 4 });
    });
  });

  describe('the audit trail', () => {
    it('records the movement, attributed to the verified principal', async () => {
      await service.update(
        PRODUCT_ID,
        { quantity: 20, changeReason: StockChangeReason.RESTOCK, reason: 'delivery 40 crates' },
        { storeId: MANAGER_STORE, actor: manager },
      );

      expect(adjustmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: new Types.ObjectId(PRODUCT_ID),
          storeId: MANAGER_STORE,
          previousQuantity: 12,
          newQuantity: 20,
          delta: 8,
          reason: StockChangeReason.RESTOCK,
          note: 'delivery 40 crates',
          changedByUserId: new Types.ObjectId(manager.userId),
          changedByRole: Role.STORE_MANAGER,
        }),
      );
    });

    it('writes nothing when there is no actor', async () => {
      // An unattributed audit row is worse than no row.
      await service.update(PRODUCT_ID, { quantity: 20 }, { storeId: MANAGER_STORE });

      expect(adjustmentModel.create).not.toHaveBeenCalled();
    });

    it('writes nothing when the quantity did not move', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 12, lowStockThreshold: 9 }),
      });

      // A threshold-only edit is not a stock movement.
      await service.update(
        PRODUCT_ID,
        { lowStockThreshold: 9 },
        { storeId: MANAGER_STORE, actor: manager },
      );

      expect(adjustmentModel.create).not.toHaveBeenCalled();
    });

    it('defaults an unlabelled movement to a correction', async () => {
      await service.update(
        PRODUCT_ID,
        { quantity: 20 },
        { storeId: MANAGER_STORE, actor: manager },
      );

      expect(adjustmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: StockChangeReason.CORRECTION }),
      );
    });

    it('does not fail the stock change when the audit write fails', async () => {
      // The stock change has already committed and is correct; a 500 here would
      // tell the manager it failed, and they would very likely apply it twice.
      adjustmentModel.create.mockRejectedValue(new Error('disk full'));

      await expect(
        service.update(PRODUCT_ID, { quantity: 20 }, { storeId: MANAGER_STORE, actor: manager }),
      ).resolves.toMatchObject({ quantity: 20 });
    });

    it('scopes the per-product history to the store', async () => {
      await service.recentAdjustments(PRODUCT_ID, MANAGER_STORE);

      expect(adjustmentModel.find).toHaveBeenCalledWith({
        productId: new Types.ObjectId(PRODUCT_ID),
        storeId: MANAGER_STORE,
      });
    });
  });
});
