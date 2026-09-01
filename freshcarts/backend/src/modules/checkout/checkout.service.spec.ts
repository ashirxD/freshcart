import { Types } from 'mongoose';
import { StockStatus, UnitType } from 'src/common/enums';
import { BusinessException, ErrorCode } from 'src/common/errors';
import { AddressesService, LeanAddress } from 'src/modules/addresses';
import { AddressLabel } from 'src/modules/addresses/schemas';
import { CartService } from 'src/modules/cart/cart.service';
import { DeliveryService } from 'src/modules/delivery';
import { FulfillmentMethod } from 'src/modules/orders/order-status.machine';
import { PaymentMethod } from 'src/modules/payments/enums';
import { PaymentsService } from 'src/modules/payments';
import { ProductView, ProductsService } from 'src/modules/products';
import { StoreDocument, StoresService } from 'src/modules/stores';
import { CheckoutService } from './checkout.service';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const USER_ID = '64b000000000000000000009';
const ADDRESS_ID = '64b0000000000000000000a1';

const MILK = new Types.ObjectId('64b000000000000000000101');
const EGGS = new Types.ObjectId('64b000000000000000000102');

function productView(overrides: Partial<ProductView> & { id: string }): ProductView {
  return {
    name: 'Product',
    slug: 'product',
    categoryId: 'c1',
    subcategoryId: null,
    images: [],
    primaryImage: null,
    sellingPrice: 340,
    compareAtPrice: null,
    discountPercent: 0,
    unitType: UnitType.LITER,
    unitValue: 1,
    unitLabel: '1 L',
    sku: 'SKU-1',
    isActive: true,
    isFeatured: false,
    stock: { quantity: 50, lowStockThreshold: 5, status: StockStatus.IN_STOCK, isAvailable: true },
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as ProductView;
}

function cartItem(
  productId: Types.ObjectId,
  quantity: number,
  unitPriceSnapshot: number | null = null,
) {
  return { productId, quantity, unitPriceSnapshot, addedAt: new Date('2026-01-01') };
}

function address(overrides: Partial<LeanAddress> = {}): LeanAddress {
  return {
    _id: new Types.ObjectId(ADDRESS_ID),
    userId: new Types.ObjectId(USER_ID),
    label: AddressLabel.HOME,
    recipientName: 'Ayesha Khan',
    phone: '+923001234569',
    houseNumber: '42-B',
    street: 'Street 4',
    area: 'Salamatpura',
    city: 'Lahore',
    landmark: 'Opposite Al-Fatah',
    deliveryInstructions: 'Ring twice',
    latitude: 31.545,
    longitude: 74.372,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as LeanAddress;
}

describe('CheckoutService', () => {
  let cartService: { findOwnCart: jest.Mock };
  let productsService: { findViewsByIds: jest.Mock };
  let addressesService: { findOwnedOrFail: jest.Mock };
  let deliveryService: { quote: jest.Mock; maxDistanceMeters: jest.Mock };
  let paymentsService: { availableMethods: jest.Mock; assertMethodIsAvailable: jest.Mock };
  let storesService: { assertAcceptingOrders: jest.Mock };
  let service: CheckoutService;

  const store = {
    _id: STORE_ID,
    name: 'FreshCarts Gulberg',
    phone: '+923004567890',
    address: { line1: 'Shop 12, Main Boulevard', area: 'Gulberg III', city: 'Lahore' },
    location: { type: 'Point', coordinates: [74.3441, 31.5102] },
  } as unknown as StoreDocument;

  beforeEach(() => {
    cartService = { findOwnCart: jest.fn() };
    productsService = { findViewsByIds: jest.fn() };
    addressesService = { findOwnedOrFail: jest.fn() };
    // The radius is business configuration read from settings, so it is an
    // async lookup rather than a synchronous property.
    deliveryService = { quote: jest.fn(), maxDistanceMeters: jest.fn().mockResolvedValue(12_000) };
    paymentsService = {
      availableMethods: jest
        .fn()
        .mockReturnValue([{ method: PaymentMethod.CASH_ON_DELIVERY, label: 'Cash on delivery' }]),
      assertMethodIsAvailable: jest.fn(),
    };
    storesService = { assertAcceptingOrders: jest.fn().mockResolvedValue(store) };

    service = new CheckoutService(
      cartService as unknown as CartService,
      productsService as unknown as ProductsService,
      addressesService as unknown as AddressesService,
      deliveryService as unknown as DeliveryService,
      paymentsService as unknown as PaymentsService,
      storesService as unknown as StoresService,
    );
  });

  function stubCart(items: ReturnType<typeof cartItem>[]) {
    cartService.findOwnCart.mockResolvedValue(items.length ? { items } : { items: [] });
  }

  function stubCatalogue(views: ProductView[]) {
    productsService.findViewsByIds.mockResolvedValue(new Map(views.map((view) => [view.id, view])));
  }

  describe('preconditions', () => {
    it('refuses when the shopper has no cart at all', async () => {
      cartService.findOwnCart.mockResolvedValue(null);

      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP }),
      ).rejects.toMatchObject({ code: ErrorCode.CART_EMPTY });
    });

    it('refuses an empty cart', async () => {
      stubCart([]);

      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP }),
      ).rejects.toMatchObject({ code: ErrorCode.CART_EMPTY });
    });

    it('refuses when the store is not accepting orders', async () => {
      storesService.assertAcceptingOrders.mockRejectedValue(
        BusinessException.storeUnavailable('Closed'),
      );

      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP }),
      ).rejects.toMatchObject({ code: ErrorCode.STORE_UNAVAILABLE });

      // The store gate runs before anything is read from the catalogue.
      expect(productsService.findViewsByIds).not.toHaveBeenCalled();
    });
  });

  describe('line validation', () => {
    it('refuses a product that has vanished from the catalogue', async () => {
      stubCart([cartItem(MILK, 2)]);
      stubCatalogue([]);

      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP }),
      ).rejects.toMatchObject({ code: ErrorCode.CHECKOUT_VALIDATION_FAILED });
    });

    it('refuses a deactivated product and names it', async () => {
      stubCart([cartItem(MILK, 2)]);
      stubCatalogue([productView({ id: MILK.toString(), name: 'Milk 1L', isActive: false })]);

      try {
        await service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP });
        fail('expected checkout to be refused');
      } catch (error) {
        const failure = error as BusinessException;
        // §45's example message, verbatim in spirit: the shopper is told which
        // product and what to do about it.
        expect(failure.message).toContain('Milk 1L');
        expect(failure.message).toContain('remove it');
      }
    });

    it('refuses when stock has dropped below the requested quantity, and says how many are left', async () => {
      stubCart([cartItem(EGGS, 5)]);
      stubCatalogue([
        productView({
          id: EGGS.toString(),
          name: 'Eggs',
          stock: {
            quantity: 2,
            lowStockThreshold: 5,
            status: StockStatus.LOW_STOCK,
            isAvailable: true,
          },
        }),
      ]);

      try {
        await service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP });
        fail('expected checkout to be refused');
      } catch (error) {
        const details = (error as BusinessException).details as {
          issues: Array<Record<string, unknown>>;
        };

        expect(details.issues[0]).toMatchObject({
          code: 'INSUFFICIENT_STOCK',
          availableQuantity: 2,
          requestedQuantity: 5,
        });
        expect((error as BusinessException).message).toContain('Only 2');
      }
    });

    it('refuses a sold-out product', async () => {
      stubCart([cartItem(MILK, 1)]);
      stubCatalogue([
        productView({
          id: MILK.toString(),
          stock: {
            quantity: 0,
            lowStockThreshold: 5,
            status: StockStatus.OUT_OF_STOCK,
            isAvailable: false,
          },
        }),
      ]);

      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP }),
      ).rejects.toMatchObject({ code: ErrorCode.CHECKOUT_VALIDATION_FAILED });
    });
  });

  describe('price changes', () => {
    it('blocks checkout and reports both prices rather than charging the new one', async () => {
      stubCart([cartItem(MILK, 2, 320)]);
      stubCatalogue([productView({ id: MILK.toString(), name: 'Milk 1L', sellingPrice: 340 })]);

      try {
        await service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP });
        fail('expected checkout to be refused');
      } catch (error) {
        const failure = error as BusinessException;
        const details = failure.details as {
          issues: Array<Record<string, unknown>>;
          requiresPriceAcceptance: boolean;
        };

        expect(details.issues[0]).toMatchObject({
          code: 'PRICE_CHANGED',
          previousPrice: 320,
          currentPrice: 340,
        });
        // Lets the client show "review the changes" rather than "fix your cart".
        expect(details.requiresPriceAcceptance).toBe(true);
      }
    });

    it('makes no claim about a line that predates the agreed-price field', async () => {
      stubCart([cartItem(MILK, 2, null)]);
      stubCatalogue([productView({ id: MILK.toString(), sellingPrice: 340 })]);

      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP }),
      ).resolves.toMatchObject({ subtotal: 680 });
    });

    it('does not offer "review prices" when a stock problem is also present', async () => {
      stubCart([cartItem(MILK, 2, 320), cartItem(EGGS, 5)]);
      stubCatalogue([
        productView({ id: MILK.toString(), sellingPrice: 340 }),
        productView({
          id: EGGS.toString(),
          stock: {
            quantity: 1,
            lowStockThreshold: 5,
            status: StockStatus.LOW_STOCK,
            isAvailable: true,
          },
        }),
      ]);

      try {
        await service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.PICKUP });
        fail('expected checkout to be refused');
      } catch (error) {
        const details = (error as BusinessException).details as {
          requiresPriceAcceptance: boolean;
        };
        expect(details.requiresPriceAcceptance).toBe(false);
      }
    });
  });

  describe('pickup', () => {
    it('prices a pickup order with no delivery fee and snapshots the store', async () => {
      stubCart([cartItem(MILK, 2, 340), cartItem(EGGS, 1, 300)]);
      stubCatalogue([
        productView({ id: MILK.toString(), sellingPrice: 340 }),
        productView({ id: EGGS.toString(), sellingPrice: 300 }),
      ]);

      const draft = await service.validate(USER_ID, {
        fulfillmentMethod: FulfillmentMethod.PICKUP,
      });

      expect(draft.subtotal).toBe(980);
      expect(draft.deliveryFee).toBe(0);
      expect(draft.total).toBe(980);
      expect(draft.delivery).toBeNull();
      expect(draft.address).toBeNull();
      expect(draft.pickup).toMatchObject({
        storeName: 'FreshCarts Gulberg',
        storeAddress: 'Shop 12, Main Boulevard, Gulberg III, Lahore',
      });

      // No address is looked up and no routing request is made for a pickup.
      expect(addressesService.findOwnedOrFail).not.toHaveBeenCalled();
      expect(deliveryService.quote).not.toHaveBeenCalled();
    });
  });

  describe('delivery', () => {
    beforeEach(() => {
      stubCart([cartItem(MILK, 2, 340)]);
      stubCatalogue([productView({ id: MILK.toString(), sellingPrice: 340 })]);
    });

    it('measures, prices and totals a delivery order', async () => {
      addressesService.findOwnedOrFail.mockResolvedValue(address());
      deliveryService.quote.mockResolvedValue({
        distanceMeters: 4_300,
        durationSeconds: 900,
        fee: 120,
        pricingRuleId: 'r2',
        pricingRuleLabel: 'Short',
        routingProvider: 'osrm',
        calculatedAt: new Date(),
      });

      const draft = await service.validate(USER_ID, {
        fulfillmentMethod: FulfillmentMethod.DELIVERY,
        addressId: ADDRESS_ID,
      });

      expect(draft.subtotal).toBe(680);
      expect(draft.deliveryFee).toBe(120);
      expect(draft.total).toBe(800);
      expect(draft.pickup).toBeNull();

      // The routing origin is the store, in human (lat, lng) order — not the
      // GeoJSON order the document stores it in.
      expect(deliveryService.quote).toHaveBeenCalledWith({
        storeId: STORE_ID,
        origin: { latitude: 31.5102, longitude: 74.3441 },
        destination: { latitude: 31.545, longitude: 74.372 },
      });
    });

    it('looks the address up scoped to the caller, never by id alone', async () => {
      addressesService.findOwnedOrFail.mockResolvedValue(address());
      deliveryService.quote.mockResolvedValue({
        distanceMeters: 1_000,
        durationSeconds: null,
        fee: 80,
        pricingRuleId: 'r1',
        pricingRuleLabel: 'Nearby',
        routingProvider: 'estimate',
        calculatedAt: new Date(),
      });

      await service.validate(USER_ID, {
        fulfillmentMethod: FulfillmentMethod.DELIVERY,
        addressId: ADDRESS_ID,
      });

      expect(addressesService.findOwnedOrFail).toHaveBeenCalledWith(USER_ID, ADDRESS_ID);
    });

    it('refuses an address with no map location', async () => {
      addressesService.findOwnedOrFail.mockResolvedValue(
        address({ latitude: null, longitude: null }),
      );

      await expect(
        service.validate(USER_ID, {
          fulfillmentMethod: FulfillmentMethod.DELIVERY,
          addressId: ADDRESS_ID,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.ADDRESS_COORDINATES_REQUIRED });

      expect(deliveryService.quote).not.toHaveBeenCalled();
    });

    it('refuses when no address was chosen', async () => {
      await expect(
        service.validate(USER_ID, { fulfillmentMethod: FulfillmentMethod.DELIVERY }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_ADDRESS });
    });

    it('carries an out-of-area refusal through unchanged', async () => {
      addressesService.findOwnedOrFail.mockResolvedValue(address());
      deliveryService.quote.mockRejectedValue(
        BusinessException.deliveryUnavailable('Too far', {
          distanceMeters: 20_000,
          maxDistanceMeters: 12_000,
        }),
      );

      await expect(
        service.validate(USER_ID, {
          fulfillmentMethod: FulfillmentMethod.DELIVERY,
          addressId: ADDRESS_ID,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.DELIVERY_UNAVAILABLE });
    });
  });

  describe('payment', () => {
    beforeEach(() => {
      stubCart([cartItem(MILK, 1, 340)]);
      stubCatalogue([productView({ id: MILK.toString(), sellingPrice: 340 })]);
    });

    it('rejects a method that is not enabled', async () => {
      paymentsService.assertMethodIsAvailable.mockImplementation(() => {
        throw BusinessException.paymentMethodUnsupported('Card');
      });

      await expect(
        service.validate(USER_ID, {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CARD,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_METHOD_UNSUPPORTED });
    });

    it('offers only the enabled methods', async () => {
      const draft = await service.validate(USER_ID, {
        fulfillmentMethod: FulfillmentMethod.PICKUP,
      });

      expect(draft.availablePaymentMethods).toEqual([
        { method: PaymentMethod.CASH_ON_DELIVERY, label: 'Cash on delivery' },
      ]);
    });
  });

  describe('the preview view', () => {
    it('exposes no internal identifiers and includes the service radius', async () => {
      stubCart([cartItem(MILK, 2, 340)]);
      stubCatalogue([productView({ id: MILK.toString(), name: 'Milk 1L', sellingPrice: 340 })]);
      addressesService.findOwnedOrFail.mockResolvedValue(address());
      deliveryService.quote.mockResolvedValue({
        distanceMeters: 4_300,
        durationSeconds: 900,
        fee: 120,
        pricingRuleId: 'r2',
        pricingRuleLabel: 'Short',
        routingProvider: 'osrm',
        calculatedAt: new Date(),
      });

      const view = await service.preview(USER_ID, {
        fulfillmentMethod: FulfillmentMethod.DELIVERY,
        addressId: ADDRESS_ID,
      });

      expect(view).toMatchObject({
        subtotal: 680,
        deliveryFee: 120,
        total: 800,
        itemCount: 1,
        totalQuantity: 2,
      });
      expect(view.delivery?.maxDistanceMeters).toBe(12_000);

      // The pricing rule and the routing provider are operational details the
      // shopper has no use for; they are snapshotted on the order instead.
      const serialised = JSON.stringify(view);
      expect(serialised).not.toContain('pricingRuleId');
      expect(serialised).not.toContain('routingProvider');
    });
  });
});
