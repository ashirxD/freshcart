import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { StockStatus } from 'src/common/enums';
import { StoresService } from 'src/modules/stores';
import { SettingsService } from 'src/modules/settings';
import { InventoryService } from './inventory.service';
import { InventoryAdjustmentDocument, InventoryDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const PRODUCT_ID = '64b000000000000000000101';

describe('InventoryService', () => {
  type MockModel = Record<string, jest.Mock>;

  let inventoryModel: MockModel;
  let adjustmentModel: MockModel;
  let service: InventoryService;

  beforeEach(() => {
    inventoryModel = {
      // `update` reads the prior quantity for the audit row before writing.
      findOne: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve({ quantity: 0 }) }) }),
      }),
      findOneAndUpdate: jest.fn(),
      exists: jest.fn().mockResolvedValue(null),
      deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
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

    const storesService = {
      getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE_ID),
    } as unknown as StoresService;

    service = new InventoryService(
      inventoryModel as unknown as Model<InventoryDocument>,
      adjustmentModel as unknown as Model<InventoryAdjustmentDocument>,
      storesService,
      { defaultLowStockThreshold: jest.fn().mockResolvedValue(5) } as unknown as SettingsService,
    );
  });

  describe('toStockView', () => {
    it('derives availability from quantity and threshold', () => {
      expect(InventoryService.toStockView({ quantity: 20, lowStockThreshold: 5 })).toEqual({
        quantity: 20,
        lowStockThreshold: 5,
        status: StockStatus.IN_STOCK,
        isAvailable: true,
      });
    });

    it('treats a missing stock row as out of stock, never as unlimited', () => {
      expect(InventoryService.toStockView(null)).toMatchObject({
        quantity: 0,
        status: StockStatus.OUT_OF_STOCK,
        isAvailable: false,
      });
    });
  });

  describe('update', () => {
    it('sets an absolute quantity', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 40, lowStockThreshold: 5 }),
      });

      const result = await service.update(PRODUCT_ID, { quantity: 40 });

      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: new Types.ObjectId(PRODUCT_ID), storeId: STORE_ID },
        { $set: { quantity: 40 } },
        { new: true },
      );
      expect(result.status).toBe(StockStatus.IN_STOCK);
    });

    it('applies a relative increase with $inc', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 22, lowStockThreshold: 5 }),
      });

      await service.update(PRODUCT_ID, { adjustBy: 12 });

      const [filter, update] = inventoryModel.findOneAndUpdate.mock.calls[0];
      expect(update).toEqual({ $inc: { quantity: 12 } });
      // An increase needs no guard, so the filter stays the plain identity.
      expect(filter).not.toHaveProperty('quantity');
    });

    it('guards a relative decrease in the filter, so it cannot go negative', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 2, lowStockThreshold: 5 }),
      });

      await service.update(PRODUCT_ID, { adjustBy: -3 });

      const [filter] = inventoryModel.findOneAndUpdate.mock.calls[0];
      // The condition lives in the query, so two concurrent decrements cannot
      // both pass a read-then-write check.
      expect(filter).toMatchObject({ quantity: { $gte: 3 } });
    });

    it('reports insufficient stock when a guarded decrease matches nothing', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(null) });
      inventoryModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.update(PRODUCT_ID, { adjustBy: -100 })).rejects.toThrow(
        /Not enough stock/,
      );
    });

    it('reports a missing stock row as 404 rather than insufficient stock', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(null) });
      inventoryModel.exists.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID, { adjustBy: -1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses an absolute and a relative change in the same request', async () => {
      await expect(
        service.update(PRODUCT_ID, { quantity: 10, adjustBy: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a request that would change nothing', async () => {
      await expect(service.update(PRODUCT_ID, {})).rejects.toThrow(/Nothing to update/);
    });

    it('reports LOW_STOCK once the quantity reaches the threshold', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 5, lowStockThreshold: 5 }),
      });

      const result = await service.update(PRODUCT_ID, { quantity: 5 });

      expect(result.status).toBe(StockStatus.LOW_STOCK);
      expect(result.isAvailable).toBe(true);
    });

    it('reports OUT_OF_STOCK at zero', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 0, lowStockThreshold: 5 }),
      });

      const result = await service.update(PRODUCT_ID, { quantity: 0 });

      expect(result.status).toBe(StockStatus.OUT_OF_STOCK);
      expect(result.isAvailable).toBe(false);
    });

    it('updates the low-stock threshold on its own', async () => {
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 30, lowStockThreshold: 12 }),
      });

      await service.update(PRODUCT_ID, { lowStockThreshold: 12 });

      const [, update] = inventoryModel.findOneAndUpdate.mock.calls[0];
      expect(update).toEqual({ $set: { lowStockThreshold: 12 } });
    });
  });

  describe('ensureFor', () => {
    it('upserts so two concurrent creates cannot both insert', async () => {
      const productId = new Types.ObjectId(PRODUCT_ID);
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ quantity: 10 }),
      });

      await service.ensureFor(productId, STORE_ID, { quantity: 10, lowStockThreshold: 4 });

      const [filter, update, options] = inventoryModel.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ productId, storeId: STORE_ID });
      expect(update.$setOnInsert).toMatchObject({ quantity: 10, lowStockThreshold: 4 });
      expect(options).toMatchObject({ upsert: true });
    });
  });
});
