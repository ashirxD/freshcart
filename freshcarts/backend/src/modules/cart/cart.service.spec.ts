import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { StockStatus, UnitType } from 'src/common/enums';
import { ProductView, ProductsService } from 'src/modules/products';
import { StoresService } from 'src/modules/stores';
import { CartService } from './cart.service';
import { CartDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const USER_ID = '64b000000000000000000009';

const MILK = new Types.ObjectId('64b000000000000000000101');
const BREAD = new Types.ObjectId('64b000000000000000000102');

function productView(overrides: Partial<ProductView> & { id: string }): ProductView {
  return {
    name: 'Product',
    slug: 'product',
    categoryId: 'c1',
    subcategoryId: null,
    images: [],
    primaryImage: null,
    sellingPrice: 100,
    compareAtPrice: null,
    discountPercent: 0,
    unitType: UnitType.PIECE,
    unitValue: 1,
    unitLabel: '1 pc',
    sku: 'SKU',
    isActive: true,
    isFeatured: false,
    stock: {
      quantity: 50,
      lowStockThreshold: 5,
      status: StockStatus.IN_STOCK,
      isAvailable: true,
    },
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as ProductView;
}

/** A cart document stand-in: a plain object plus a recording `save`. */
function cartDocument(
  items: Array<{
    productId: Types.ObjectId;
    quantity: number;
    unitPriceSnapshot?: number | null;
  }> = [],
) {
  const document = {
    _id: new Types.ObjectId('64b0000000000000000000aa'),
    userId: new Types.ObjectId(USER_ID),
    storeId: STORE_ID,
    items: items.map((item) => ({
      unitPriceSnapshot: null as number | null,
      ...item,
      addedAt: new Date('2026-01-01'),
    })),
    updatedAt: new Date('2026-01-02'),
    save: jest.fn(),
  };
  document.save.mockResolvedValue(document);
  return document;
}

describe('CartService', () => {
  type MockModel = Record<string, jest.Mock>;

  let cartModel: MockModel;
  let productsService: jest.Mocked<
    Pick<ProductsService, 'findPurchasableOrFail' | 'findViewsByIds'>
  >;
  let service: CartService;

  const milkProduct = {
    _id: MILK,
    name: "Olper's Full Cream Milk",
    sellingPrice: 240,
    isActive: true,
  };

  beforeEach(() => {
    cartModel = {
      findOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
    };

    productsService = {
      findPurchasableOrFail: jest.fn(),
      findViewsByIds: jest.fn().mockResolvedValue(new Map()),
    };

    const storesService = {
      getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE_ID),
    } as unknown as StoresService;

    service = new CartService(
      cartModel as unknown as Model<CartDocument>,
      productsService as unknown as ProductsService,
      storesService,
    );
  });

  function stubPurchasable(quantity: number) {
    productsService.findPurchasableOrFail.mockResolvedValue({
      product: milkProduct,
      stock: {
        quantity,
        lowStockThreshold: 5,
        status: quantity > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK,
        isAvailable: quantity > 0,
      },
    } as never);
  }

  describe('addItem', () => {
    it('adds a new line when the product is available', async () => {
      const cart = cartDocument();
      stubPurchasable(50);
      cartModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(cart) });

      await service.addItem(USER_ID, { productId: MILK.toHexString(), quantity: 2 });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]).toMatchObject({ productId: MILK, quantity: 2 });
      expect(cart.save).toHaveBeenCalled();
    });

    it('accumulates onto an existing line rather than duplicating it', async () => {
      const cart = cartDocument([{ productId: MILK, quantity: 3 }]);
      stubPurchasable(50);
      cartModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(cart) });

      await service.addItem(USER_ID, { productId: MILK.toHexString(), quantity: 2 });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5);
    });

    it('refuses an out-of-stock product', async () => {
      stubPurchasable(0);
      cartModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(cartDocument()) });

      await expect(
        service.addItem(USER_ID, { productId: MILK.toHexString(), quantity: 1 }),
      ).rejects.toThrow(/out of stock/);
    });

    it('checks stock against the resulting quantity, not the increment', async () => {
      // 4 already in the cart, 2 more requested, only 5 on hand.
      const cart = cartDocument([{ productId: MILK, quantity: 4 }]);
      stubPurchasable(5);
      cartModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(cart) });

      await expect(
        service.addItem(USER_ID, { productId: MILK.toHexString(), quantity: 2 }),
      ).rejects.toThrow(/Only 5 .* are left/);
      expect(cart.save).not.toHaveBeenCalled();
    });

    it('propagates the inactive-product rejection from the authoritative lookup', async () => {
      productsService.findPurchasableOrFail.mockRejectedValue(
        new ConflictException('"Dettol Soap" is no longer available'),
      );

      await expect(
        service.addItem(USER_ID, { productId: MILK.toHexString(), quantity: 1 }),
      ).rejects.toThrow(/no longer available/);
    });
  });

  describe('addItems (bulk, for the grocery-list scanner)', () => {
    const EGGS = new Types.ObjectId('64b000000000000000000103');

    function stubCatalogue(views: ProductView[]) {
      productsService.findViewsByIds.mockResolvedValue(
        new Map(views.map((view) => [view.id, view])),
      );
    }

    function stubCart(cart: ReturnType<typeof cartDocument>) {
      cartModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(cart) });
    }

    it('adds every product that can be bought', async () => {
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([
        productView({ id: MILK.toHexString(), name: 'Milk', sellingPrice: 240 }),
        productView({ id: BREAD.toHexString(), name: 'Bread', sellingPrice: 180 }),
      ]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 2 },
        { productId: BREAD.toHexString(), quantity: 1 },
      ]);

      expect(result.added).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(cart.items).toHaveLength(2);
    });

    it('accumulates onto a line the cart already has', async () => {
      // §32: Milk x1 in the cart plus Milk x2 from a scan is Milk x3, not a
      // second Milk line.
      const cart = cartDocument([{ productId: MILK, quantity: 1 }]);
      stubCart(cart);
      stubCatalogue([productView({ id: MILK.toHexString(), name: 'Milk' })]);

      await service.addItems(USER_ID, [{ productId: MILK.toHexString(), quantity: 2 }]);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(3);
    });

    it('merges the same product listed twice in one request', async () => {
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([productView({ id: MILK.toHexString(), name: 'Milk' })]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 1 },
        { productId: MILK.toHexString(), quantity: 2 },
      ]);

      expect(result.added).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(3);
    });

    it('prices from the catalogue, never from what was asked for', async () => {
      // §34: a price change between the scan and the confirmation is resolved
      // in favour of the current truth, silently and correctly.
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([productView({ id: MILK.toHexString(), name: 'Milk', sellingPrice: 355 })]);

      await service.addItems(USER_ID, [{ productId: MILK.toHexString(), quantity: 1 }]);

      expect(cart.items[0].unitPriceSnapshot).toBe(355);
    });

    it('adds what it can and reports what it cannot', async () => {
      // §31: one sold-out item must not cost the shopper the other two.
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([
        productView({ id: MILK.toHexString(), name: 'Milk' }),
        productView({
          id: EGGS.toHexString(),
          name: 'Desi Anday',
          stock: {
            quantity: 4,
            lowStockThreshold: 5,
            status: StockStatus.LOW_STOCK,
            isAvailable: true,
          },
        }),
      ]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 2 },
        { productId: EGGS.toHexString(), quantity: 10 },
      ]);

      expect(result.added).toHaveLength(1);
      expect(result.failed).toEqual([
        {
          productId: EGGS.toHexString(),
          productName: 'Desi Anday',
          requestedQuantity: 10,
          reason: 'INSUFFICIENT_STOCK',
          availableQuantity: 4,
        },
      ]);
      expect(cart.items).toHaveLength(1);
    });

    it('refuses an out-of-stock product', async () => {
      // §33: OCR must not bypass inventory. It never reaches the cart at all.
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([
        productView({
          id: MILK.toHexString(),
          name: 'Milk',
          stock: {
            quantity: 0,
            lowStockThreshold: 5,
            status: StockStatus.OUT_OF_STOCK,
            isAvailable: false,
          },
        }),
      ]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 1 },
      ]);

      expect(result.failed[0].reason).toBe('OUT_OF_STOCK');
      expect(cart.items).toHaveLength(0);
    });

    it('refuses a deactivated product', async () => {
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([productView({ id: MILK.toHexString(), name: 'Milk', isActive: false })]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 1 },
      ]);

      expect(result.failed[0].reason).toBe('UNAVAILABLE');
    });

    it('refuses a product that is not in this store', async () => {
      // §55: the catalogue read is scoped by store, so a product from another
      // store is indistinguishable from one that does not exist. The client
      // learns nothing either way.
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 1 },
      ]);

      expect(result.failed[0]).toMatchObject({ reason: 'PRODUCT_NOT_FOUND', productName: null });
    });

    it('counts an existing cart line towards the stock ceiling', async () => {
      // The same rule addItem applies: availability is checked against the
      // RESULTING quantity, so a scan cannot walk past the stock level.
      const cart = cartDocument([{ productId: MILK, quantity: 3 }]);
      stubCart(cart);
      stubCatalogue([
        productView({
          id: MILK.toHexString(),
          name: 'Milk',
          stock: {
            quantity: 4,
            lowStockThreshold: 5,
            status: StockStatus.LOW_STOCK,
            isAvailable: true,
          },
        }),
      ]);

      const result = await service.addItems(USER_ID, [
        { productId: MILK.toHexString(), quantity: 2 },
      ]);

      expect(result.failed[0].reason).toBe('INSUFFICIENT_STOCK');
      expect(cart.items[0].quantity).toBe(3);
    });

    it('does not write when nothing could be added', async () => {
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([]);

      await service.addItems(USER_ID, [{ productId: MILK.toHexString(), quantity: 1 }]);

      expect(cart.save).not.toHaveBeenCalled();
    });

    it('costs the same whether one product is added or ten', async () => {
      // §68: no N+1. The catalogue is read in batches — once to validate, once
      // to build the returned cart — so the query count is a constant, not a
      // function of how long the shopping list was.
      async function queriesFor(count: number): Promise<number> {
        const cart = cartDocument();
        stubCart(cart);

        const ids = Array.from({ length: count }, (_, index) =>
          new Types.ObjectId(64_000 + index).toHexString(),
        );

        stubCatalogue(ids.map((id) => productView({ id, name: 'Product ' + id })));
        productsService.findViewsByIds.mockClear();

        await service.addItems(
          USER_ID,
          ids.map((productId) => ({ productId, quantity: 1 })),
        );

        expect(cart.save).toHaveBeenCalledTimes(1);
        return productsService.findViewsByIds.mock.calls.length;
      }

      expect(await queriesFor(10)).toBe(await queriesFor(1));
    });

    it('scopes the cart to the authenticated shopper', async () => {
      const cart = cartDocument();
      stubCart(cart);
      stubCatalogue([productView({ id: MILK.toHexString(), name: 'Milk' })]);

      await service.addItems(USER_ID, [{ productId: MILK.toHexString(), quantity: 1 }]);

      const [filter] = cartModel.findOneAndUpdate.mock.calls[0] as [Record<string, unknown>];
      expect(filter.userId).toEqual(new Types.ObjectId(USER_ID));
      expect(filter.storeId).toBe(STORE_ID);
    });
  });

  describe('updateItem', () => {
    it('caps the quantity at the available stock', async () => {
      const cart = cartDocument([{ productId: MILK, quantity: 1 }]);
      stubPurchasable(3);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });

      await expect(
        service.updateItem(USER_ID, MILK.toHexString(), { quantity: 4 }),
      ).rejects.toThrow(/Only 3/);
    });

    it('rejects a product that is not in the cart', async () => {
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cartDocument()) });

      await expect(
        service.updateItem(USER_ID, MILK.toHexString(), { quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the cart lookup to the authenticated user', async () => {
      const cart = cartDocument([{ productId: MILK, quantity: 1 }]);
      stubPurchasable(10);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });

      await service.updateItem(USER_ID, MILK.toHexString(), { quantity: 2 });

      expect(cartModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(USER_ID),
        storeId: STORE_ID,
      });
    });
  });

  describe('removeItem', () => {
    it('removes only the requested line', async () => {
      const cart = cartDocument([
        { productId: MILK, quantity: 1 },
        { productId: BREAD, quantity: 2 },
      ]);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });

      await service.removeItem(USER_ID, MILK.toHexString());

      expect(cart.items.map((item) => item.productId)).toEqual([BREAD]);
    });

    it('reports a line that was never there', async () => {
      cartModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(cartDocument([{ productId: BREAD, quantity: 1 }])),
      });

      await expect(service.removeItem(USER_ID, MILK.toHexString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('clear', () => {
    it('empties only the authenticated user’s cart', async () => {
      cartModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(cartDocument()),
      });

      await service.clear(USER_ID);

      expect(cartModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(USER_ID), storeId: STORE_ID },
        { $set: { items: [] } },
        { new: true },
      );
    });
  });

  describe('pricing', () => {
    it('computes the subtotal from catalogue prices, not stored ones', async () => {
      const cart = cartDocument([
        { productId: MILK, quantity: 2 },
        { productId: BREAD, quantity: 3 },
      ]);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });

      productsService.findViewsByIds.mockResolvedValue(
        new Map([
          [MILK.toHexString(), productView({ id: MILK.toHexString(), sellingPrice: 240 })],
          [BREAD.toHexString(), productView({ id: BREAD.toHexString(), sellingPrice: 180 })],
        ]),
      );

      const result = await service.getCart(USER_ID);

      expect(result.subtotal).toBe(2 * 240 + 3 * 180);
      expect(result.itemCount).toBe(2);
      expect(result.totalQuantity).toBe(5);
      expect(result.hasIssues).toBe(false);
    });

    it('flags a deactivated product and leaves it out of the subtotal', async () => {
      const cart = cartDocument([{ productId: MILK, quantity: 2 }]);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });

      productsService.findViewsByIds.mockResolvedValue(
        new Map([
          [
            MILK.toHexString(),
            productView({ id: MILK.toHexString(), sellingPrice: 240, isActive: false }),
          ],
        ]),
      );

      const result = await service.getCart(USER_ID);

      expect(result.items[0].issue).toBe('UNAVAILABLE');
      expect(result.items[0].lineTotal).toBe(0);
      expect(result.subtotal).toBe(0);
      expect(result.hasIssues).toBe(true);
    });

    it('flags a line whose quantity now exceeds the stock left', async () => {
      const cart = cartDocument([{ productId: MILK, quantity: 10 }]);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });

      productsService.findViewsByIds.mockResolvedValue(
        new Map([
          [
            MILK.toHexString(),
            productView({
              id: MILK.toHexString(),
              sellingPrice: 240,
              stock: {
                quantity: 4,
                lowStockThreshold: 5,
                status: StockStatus.LOW_STOCK,
                isAvailable: true,
              },
            }),
          ],
        ]),
      );

      const result = await service.getCart(USER_ID);

      expect(result.items[0].issue).toBe('QUANTITY_REDUCED');
      expect(result.items[0].maxQuantity).toBe(4);
      expect(result.subtotal).toBe(0);
    });

    it('flags a product that has vanished from the catalogue', async () => {
      const cart = cartDocument([{ productId: MILK, quantity: 1 }]);
      cartModel.findOne.mockReturnValue({ exec: () => Promise.resolve(cart) });
      productsService.findViewsByIds.mockResolvedValue(new Map());

      const result = await service.getCart(USER_ID);

      expect(result.items[0].product).toBeNull();
      expect(result.items[0].issue).toBe('UNAVAILABLE');
    });

    it('returns an empty cart for a shopper who has none', async () => {
      const result = await service.getCart(USER_ID);

      expect(result).toMatchObject({ id: null, items: [], subtotal: 0, hasIssues: false });
      expect(productsService.findViewsByIds).not.toHaveBeenCalled();
    });
  });
});
