import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UnitType } from 'src/common/enums';
import { CategoriesService } from 'src/modules/categories';
import { CategoryDocument } from 'src/modules/categories/schemas';
import { CartDocument } from 'src/modules/cart/schemas';
import { FavoriteDocument } from 'src/modules/favorites/schemas';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { StoresService } from 'src/modules/stores';
import { ProductSort } from './dto';
import { ProductsService } from './products.service';
import { ProductDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const CATEGORY_ID = new Types.ObjectId('64b000000000000000000011');
const SUBCATEGORY_ID = new Types.ObjectId('64b000000000000000000012');
const PRODUCT_ID = new Types.ObjectId('64b000000000000000000101');

function chain<T>(result: T) {
  const query = {
    select: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => query,
    exec: () => Promise.resolve(result),
  };
  return query;
}

const validProduct = {
  name: 'Olper’s Milk',
  categoryId: CATEGORY_ID.toHexString(),
  subcategoryId: SUBCATEGORY_ID.toHexString(),
  sellingPrice: 240,
  unitType: UnitType.LITER,
  unitValue: 1,
  sku: 'fc-dai-001',
};

describe('ProductsService', () => {
  type MockModel = Record<string, jest.Mock>;

  let productModel: MockModel;
  let categoryModel: MockModel;
  let cartModel: MockModel;
  let favoriteModel: MockModel;
  let categoriesService: jest.Mocked<
    Pick<CategoriesService, 'assertValidProductCategories' | 'resolveFilterIds'>
  >;
  let inventoryService: jest.Mocked<
    Pick<InventoryService, 'ensureFor' | 'getFor' | 'removeForProduct'>
  >;
  let service: ProductsService;

  beforeEach(() => {
    productModel = {
      find: jest.fn().mockReturnValue(chain([])),
      findOne: jest.fn().mockReturnValue(chain(null)),
      create: jest
        .fn()
        .mockResolvedValue({ _id: PRODUCT_ID, sku: 'FC-DAI-001', slug: 'olpers-milk' }),
      exists: jest.fn().mockResolvedValue(null),
      deleteOne: jest.fn().mockReturnValue(chain(undefined)),
      distinct: jest.fn().mockReturnValue(chain([])),
      aggregate: jest.fn().mockReturnValue(chain([{ items: [], total: [] }])),
    };

    categoryModel = { find: jest.fn().mockReturnValue(chain([])) };
    cartModel = { exists: jest.fn().mockResolvedValue(null) };
    favoriteModel = { deleteMany: jest.fn().mockReturnValue(chain({ deletedCount: 0 })) };

    categoriesService = {
      assertValidProductCategories: jest
        .fn()
        .mockResolvedValue({ categoryId: CATEGORY_ID, subcategoryId: SUBCATEGORY_ID }),
      resolveFilterIds: jest.fn().mockResolvedValue([CATEGORY_ID, SUBCATEGORY_ID]),
    } as never;

    inventoryService = {
      ensureFor: jest.fn().mockResolvedValue({}),
      getFor: jest.fn().mockResolvedValue({
        quantity: 10,
        lowStockThreshold: 5,
        status: 'IN_STOCK',
        isAvailable: true,
      }),
      removeForProduct: jest.fn().mockResolvedValue(undefined),
    } as never;

    const storesService = {
      getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE_ID),
    } as unknown as StoresService;

    service = new ProductsService(
      productModel as unknown as Model<ProductDocument>,
      categoryModel as unknown as Model<CategoryDocument>,
      cartModel as unknown as Model<CartDocument>,
      favoriteModel as unknown as Model<FavoriteDocument>,
      categoriesService as unknown as CategoriesService,
      inventoryService as unknown as InventoryService,
      storesService,
    );
  });

  /** Lets `create`/`update` finish, since both re-read the product to respond. */
  function stubDetailRead() {
    productModel.findOne.mockReturnValue(
      chain({
        _id: PRODUCT_ID,
        name: 'Olper’s Milk',
        slug: 'olpers-milk',
        categoryId: CATEGORY_ID,
        subcategoryId: SUBCATEGORY_ID,
        storeId: STORE_ID,
        images: [],
        sellingPrice: 240,
        compareAtPrice: null,
        unitType: UnitType.LITER,
        unitValue: 1,
        sku: 'FC-DAI-001',
        searchTerms: [],
        isActive: true,
        isFeatured: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      }),
    );
  }

  describe('create', () => {
    it('uppercases the SKU, derives the slug and scopes to the active store', async () => {
      stubDetailRead();

      await service.create(validProduct);

      expect(productModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'FC-DAI-001',
          slug: 'olpers-milk',
          storeId: STORE_ID,
          categoryId: CATEGORY_ID,
          subcategoryId: SUBCATEGORY_ID,
        }),
      );
    });

    it('creates the stock row in the same request', async () => {
      stubDetailRead();

      await service.create({ ...validProduct, initialQuantity: 25, lowStockThreshold: 8 });

      expect(inventoryService.ensureFor).toHaveBeenCalledWith(PRODUCT_ID, STORE_ID, {
        quantity: 25,
        lowStockThreshold: 8,
      });
    });

    it('rolls the product back if its stock row cannot be created', async () => {
      // A product with no stock row would read as permanently out of stock and
      // could never be restocked, so a half-created product must not survive.
      inventoryService.ensureFor.mockRejectedValue(new Error('write failed'));

      await expect(service.create(validProduct)).rejects.toThrow('write failed');
      expect(productModel.deleteOne).toHaveBeenCalledWith({ _id: PRODUCT_ID });
    });

    it('rejects a SKU that is already used in this store', async () => {
      productModel.exists.mockImplementation((filter: Record<string, unknown>) =>
        Promise.resolve(filter.sku === 'FC-DAI-001' ? { _id: PRODUCT_ID } : null),
      );

      await expect(service.create(validProduct)).rejects.toBeInstanceOf(ConflictException);
      expect(productModel.create).not.toHaveBeenCalled();
    });

    it('translates a duplicate-key race into a conflict, not a 500', async () => {
      // The unique index is the real authority; the pre-check can lose a race.
      productModel.create.mockRejectedValue(
        Object.assign(new Error('E11000'), { code: 11000, keyPattern: { sku: 1 } }),
      );

      await expect(service.create(validProduct)).rejects.toBeInstanceOf(ConflictException);
    });

    it('delegates category validation instead of re-implementing it', async () => {
      categoriesService.assertValidProductCategories.mockRejectedValue(
        new Error('subcategoryId must be a child of the selected category'),
      );

      await expect(service.create(validProduct)).rejects.toThrow(/must be a child/);
    });
  });

  describe('update', () => {
    function stubEditableProduct(overrides: Record<string, unknown> = {}) {
      const document = {
        _id: PRODUCT_ID,
        name: 'Old name',
        slug: 'old-name',
        sku: 'FC-DAI-001',
        brand: 'Old brand',
        categoryId: CATEGORY_ID,
        subcategoryId: SUBCATEGORY_ID,
        sellingPrice: 240,
        compareAtPrice: 300,
        isActive: true,
        isFeatured: false,
        searchTerms: [],
        images: [],
        save: jest.fn(),
        ...overrides,
      };
      document.save.mockResolvedValue(document);
      productModel.findOne.mockReturnValueOnce({ exec: () => Promise.resolve(document) });
      return document;
    }

    it('leaves untouched fields alone', async () => {
      const document = stubEditableProduct();
      stubDetailRead();

      await service.update(PRODUCT_ID.toHexString(), { sellingPrice: 275 });

      expect(document.sellingPrice).toBe(275);
      // Omitted keys must not be interpreted as "clear this".
      expect(document.name).toBe('Old name');
      expect(document.brand).toBe('Old brand');
      expect(document.compareAtPrice).toBe(300);
    });

    it('treats an explicit null compare-at price as "remove the discount"', async () => {
      const document = stubEditableProduct();
      stubDetailRead();

      await service.update(PRODUCT_ID.toHexString(), { compareAtPrice: null });

      expect(document.compareAtPrice).toBeNull();
    });

    it('normalises search aliases to lowercase', async () => {
      const document = stubEditableProduct();
      stubDetailRead();

      await service.update(PRODUCT_ID.toHexString(), { searchTerms: [' Doodh ', 'MILK', ''] });

      expect(document.searchTerms).toEqual(['doodh', 'milk']);
    });

    it('rejects a SKU already used by a different product', async () => {
      stubEditableProduct();
      productModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.update(PRODUCT_ID.toHexString(), { sku: 'FC-OTHER-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('setActive', () => {
    it('reports a product from another store as not found', async () => {
      productModel.findOneAndUpdate = jest.fn().mockReturnValue(chain(null));

      await expect(service.setActive(PRODUCT_ID.toHexString(), false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    function stubExistingProduct() {
      const document = {
        _id: PRODUCT_ID,
        sku: 'FC-DAI-001',
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      productModel.findOne.mockReturnValue(chain(document));
      return document;
    }

    it('refuses to delete a product that sits in a shopper’s cart', async () => {
      stubExistingProduct();
      cartModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.remove(PRODUCT_ID.toHexString())).rejects.toThrow(
        /Deactivate it instead/,
      );
    });

    it('cleans up favourites and stock when the delete is safe', async () => {
      const document = stubExistingProduct();

      await service.remove(PRODUCT_ID.toHexString());

      expect(favoriteModel.deleteMany).toHaveBeenCalledWith({ productId: PRODUCT_ID });
      expect(inventoryService.removeForProduct).toHaveBeenCalledWith(PRODUCT_ID, STORE_ID);
      expect(document.deleteOne).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    /** Pulls the `$match` stage out of the pipeline the service built. */
    async function matchStageFor(query: Record<string, unknown>) {
      await service.list(Object.assign({ page: 1, limit: 20, skip: 0 }, query) as never);
      const [pipeline] = productModel.aggregate.mock.calls[0] as [Array<Record<string, unknown>>];
      return pipeline[0].$match as Record<string, unknown>;
    }

    it('hides inactive products from customers', async () => {
      expect(await matchStageFor({})).toMatchObject({ storeId: STORE_ID, isActive: true });
    });

    it('shows inactive products only when the caller is allowed to see them', async () => {
      await service.list({ page: 1, limit: 20, skip: 0 } as never, { includeInactive: true });
      const [pipeline] = productModel.aggregate.mock.calls[0] as [Array<Record<string, unknown>>];

      expect(pipeline[0].$match).not.toHaveProperty('isActive');
    });

    it('treats a non-null compare-at price as the discount filter', async () => {
      expect(await matchStageFor({ discounted: true })).toMatchObject({
        compareAtPrice: { $ne: null },
      });
    });

    it('applies both price bounds', async () => {
      expect(await matchStageFor({ minPrice: 100, maxPrice: 500 })).toMatchObject({
        sellingPrice: { $gte: 100, $lte: 500 },
      });
    });

    it('rejects an inverted price range', async () => {
      await expect(
        service.list({ page: 1, limit: 20, skip: 0, minPrice: 500, maxPrice: 100 } as never),
      ).rejects.toThrow(/minPrice cannot be greater/);
    });

    it('matches nothing for an unknown category, rather than everything', async () => {
      categoriesService.resolveFilterIds.mockResolvedValue([]);

      expect(await matchStageFor({ category: 'does-not-exist' })).toEqual({ _id: { $in: [] } });
    });

    it('expands a category filter across the category and its subcategories', async () => {
      const match = await matchStageFor({ category: 'dairy-eggs' });
      const and = match.$and as Array<Record<string, unknown>>;

      expect(and[0]).toEqual({
        $or: [
          { categoryId: { $in: [CATEGORY_ID, SUBCATEGORY_ID] } },
          { subcategoryId: { $in: [CATEGORY_ID, SUBCATEGORY_ID] } },
        ],
      });
    });

    it('searches name, brand, aliases and exact SKU/barcode', async () => {
      const match = await matchStageFor({ search: 'doodh' });
      const clause = (match.$and as Array<{ $or: Array<Record<string, unknown>> }>)[0];

      expect(clause.$or.map((entry) => Object.keys(entry)[0])).toEqual([
        'name',
        'brand',
        'searchTerms',
        'sku',
        'barcode',
      ]);
      expect(clause.$or[3]).toEqual({ sku: 'DOODH' });
    });

    it('escapes regex metacharacters in the search term', async () => {
      const match = await matchStageFor({ search: 'a+b' });
      const clause = (match.$and as Array<{ $or: Array<{ name: RegExp }> }>)[0];

      // Unescaped, `a+b` would be a quantifier — a wrong result and a ReDoS risk.
      expect(clause.$or[0].name.source).toContain('a\\+b');
    });

    it('sorts by price without needing a computed field', async () => {
      await service.list({
        page: 1,
        limit: 20,
        skip: 0,
        sort: ProductSort.PRICE_ASC,
      } as never);

      const [pipeline] = productModel.aggregate.mock.calls[0] as [Array<Record<string, unknown>>];
      expect(pipeline.some((stage) => '$addFields' in stage)).toBe(false);
    });

    it('falls back to merchandised order when relevance has no search term', async () => {
      await service.list({
        page: 1,
        limit: 20,
        skip: 0,
        sort: ProductSort.RELEVANCE,
      } as never);

      const [pipeline] = productModel.aggregate.mock.calls[0] as [
        Array<{ $facet?: { items: Array<Record<string, unknown>> } }>,
      ];
      const facet = pipeline.find((stage) => stage.$facet);

      expect(facet?.$facet?.items[0]).toEqual({
        $sort: { isFeatured: -1, createdAt: -1, _id: 1 },
      });
    });
  });
});
