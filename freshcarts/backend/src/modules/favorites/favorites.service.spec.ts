import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { PaginationQueryDto } from 'src/common/dto';
import { ProductsService } from 'src/modules/products';
import { StoresService } from 'src/modules/stores';
import { FavoritesService } from './favorites.service';
import { FavoriteDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const USER_ID = '64b000000000000000000009';
const PRODUCT_ID = '64b000000000000000000101';

function chain<T>(result: T) {
  const query = {
    find: () => query,
    select: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => query,
    exec: () => Promise.resolve(result),
  };
  return query;
}

describe('FavoritesService', () => {
  type MockModel = Record<string, jest.Mock>;

  let favoriteModel: MockModel;
  let productsService: jest.Mocked<Pick<ProductsService, 'findViewsByIds'>>;
  let service: FavoritesService;

  beforeEach(() => {
    favoriteModel = {
      find: jest.fn().mockReturnValue(chain([])),
      findOneAndUpdate: jest.fn().mockReturnValue(chain({})),
      deleteOne: jest.fn().mockReturnValue(chain({ deletedCount: 1 })),
      countDocuments: jest.fn().mockReturnValue(chain(0)),
    };

    productsService = {
      findViewsByIds: jest
        .fn()
        .mockResolvedValue(new Map([[PRODUCT_ID, { id: PRODUCT_ID, name: 'Milk' }]])),
    } as never;

    const storesService = {
      getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE_ID),
    } as unknown as StoresService;

    service = new FavoritesService(
      favoriteModel as unknown as Model<FavoriteDocument>,
      productsService as unknown as ProductsService,
      storesService,
    );
  });

  describe('add', () => {
    it('upserts, so favouriting the same product twice creates one row', async () => {
      await service.add(USER_ID, PRODUCT_ID);
      await service.add(USER_ID, PRODUCT_ID);

      expect(favoriteModel.findOneAndUpdate).toHaveBeenCalledTimes(2);

      for (const [filter, , options] of favoriteModel.findOneAndUpdate.mock.calls) {
        expect(filter).toEqual({
          userId: new Types.ObjectId(USER_ID),
          productId: new Types.ObjectId(PRODUCT_ID),
        });
        expect(options).toMatchObject({ upsert: true });
      }
    });

    it('refuses to save a product that is not in this store', async () => {
      productsService.findViewsByIds.mockResolvedValue(new Map());

      await expect(service.add(USER_ID, PRODUCT_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(favoriteModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('allows saving a product that is temporarily out of stock', async () => {
      // Saving something for later is exactly when it is unavailable, so this
      // path deliberately does not use the purchasable lookup.
      await expect(service.add(USER_ID, PRODUCT_ID)).resolves.toEqual({
        productId: PRODUCT_ID,
        isFavorite: true,
      });
    });
  });

  describe('remove', () => {
    it('scopes the delete to the authenticated user', async () => {
      await service.remove(USER_ID, PRODUCT_ID);

      expect(favoriteModel.deleteOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(USER_ID),
        productId: new Types.ObjectId(PRODUCT_ID),
      });
    });

    it('is idempotent when the favourite was already gone', async () => {
      favoriteModel.deleteOne.mockReturnValue(chain({ deletedCount: 0 }));

      await expect(service.remove(USER_ID, PRODUCT_ID)).resolves.toEqual({
        productId: PRODUCT_ID,
        isFavorite: false,
      });
    });
  });

  describe('list', () => {
    it('resolves products in one batch rather than per favourite', async () => {
      const ids = [
        new Types.ObjectId('64b000000000000000000101'),
        new Types.ObjectId('64b000000000000000000102'),
      ];

      favoriteModel.find.mockReturnValue(
        chain(ids.map((productId) => ({ productId, createdAt: new Date('2026-01-01') }))),
      );
      favoriteModel.countDocuments.mockReturnValue(chain(2));

      const result = await service.list(USER_ID, Object.assign(new PaginationQueryDto(), {}));

      expect(productsService.findViewsByIds).toHaveBeenCalledTimes(1);
      expect(result.pagination.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('keeps a favourite whose product has been deleted, with a null product', async () => {
      favoriteModel.find.mockReturnValue(
        chain([
          { productId: new Types.ObjectId('64b000000000000000000999'), createdAt: new Date() },
        ]),
      );
      favoriteModel.countDocuments.mockReturnValue(chain(1));
      productsService.findViewsByIds.mockResolvedValue(new Map());

      const result = await service.list(USER_ID, Object.assign(new PaginationQueryDto(), {}));

      expect(result.items[0].product).toBeNull();
    });
  });
});
