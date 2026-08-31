import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { TransactionRunner } from 'src/common/database';
import { IdempotencyService } from 'src/common/idempotency';
import { UnitType } from 'src/common/enums';
import { BusinessException, ErrorCode } from 'src/common/errors';
import { CartService } from 'src/modules/cart/cart.service';
import { CheckoutDraft, CheckoutService } from 'src/modules/checkout';
import { InventoryService } from 'src/modules/inventory';
import { PaymentsService } from 'src/modules/payments';
import { PaymentMethod, PaymentStatus } from 'src/modules/payments/enums';
import { StoresService } from 'src/modules/stores';
import { OrderNumberService } from './order-number.service';
import { FulfillmentMethod, OrderStatus } from './order-status.machine';
import { OrdersService } from './orders.service';
import { ProductDocument } from 'src/modules/products/schemas';
import { UserDocument } from 'src/modules/users/schemas';
import { OrderDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const USER_ID = '64b000000000000000000009';
const ORDER_ID = new Types.ObjectId('64b0000000000000000000f1');
const MILK = new Types.ObjectId('64b000000000000000000101');
const EGGS = new Types.ObjectId('64b000000000000000000102');
const KEY = 'attempt-0001-aaaa';

function draft(overrides: Partial<CheckoutDraft> = {}): CheckoutDraft {
  return {
    storeId: STORE_ID,
    fulfillmentMethod: FulfillmentMethod.PICKUP,
    lines: [
      {
        productId: MILK,
        productName: 'Milk 1L',
        productImage: null,
        brand: null,
        sku: 'MILK-1L',
        unitLabel: '1 L',
        unitType: UnitType.LITER,
        unitValue: 1,
        quantity: 2,
        unitPrice: 340,
        lineTotal: 680,
      },
    ],
    subtotal: 680,
    deliveryFee: 0,
    discount: 0,
    total: 680,
    currency: 'PKR',
    address: null,
    delivery: null,
    pickup: {
      storeName: 'FreshCarts Gulberg',
      storeAddress: 'Shop 12, Gulberg III, Lahore',
      storePhone: '+923004567890',
      latitude: 31.5102,
      longitude: 74.3441,
      instructions: 'Bring your order number.',
    },
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    availablePaymentMethods: [
      { method: PaymentMethod.CASH_ON_DELIVERY, label: 'Cash on delivery' },
    ],
    ...overrides,
  };
}

/** A created order document that behaves enough like Mongoose for the service. */
function orderDocument(overrides: Record<string, unknown> = {}) {
  const document: Record<string, unknown> = {
    _id: ORDER_ID,
    orderNumber: 'FC-2026-0000001',
    userId: new Types.ObjectId(USER_ID),
    storeId: STORE_ID,
    fulfillmentMethod: FulfillmentMethod.PICKUP,
    items: [{ productId: MILK, quantity: 2 }],
    status: OrderStatus.PENDING,
    statusHistory: [],
    payment: {
      method: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.PENDING,
      paidAt: null,
    },
    pricing: { subtotal: 680, deliveryFee: 0, discount: 0, total: 680, currency: 'PKR' },
    inventoryRestored: false,
    cancelledAt: null,
    cancellationReason: null,
    cancelledByRole: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  document.save = jest.fn().mockResolvedValue(document);
  document.toObject = jest.fn(() => ({ ...document }));

  return document as Record<string, unknown> & { save: jest.Mock; toObject: jest.Mock };
}

describe('OrdersService', () => {
  type MockModel = Record<string, jest.Mock>;

  let orderModel: MockModel;
  let userModel: MockModel;
  let productModel: MockModel;
  let checkoutService: { validate: jest.Mock };
  let inventoryService: { tryReserve: jest.Mock; release: jest.Mock };
  let paymentsService: {
    createForOrder: jest.Mock;
    removeForOrder: jest.Mock;
    markPaid: jest.Mock;
    markFailedForCancellation: jest.Mock;
  };
  let cartService: { removePurchasedItems: jest.Mock };
  let idempotencyService: { claim: jest.Mock; complete: jest.Mock; release: jest.Mock };
  let service: OrdersService;

  /**
   * A runner that behaves like the standalone-MongoDB path: no session, and
   * compensations replayed in reverse on failure. That is the harder of the two
   * paths and the one the local deployment actually uses.
   */
  const compensatingRunner = {
    run: jest.fn(async (work: (context: unknown) => Promise<unknown>) => {
      const compensations: Array<() => Promise<unknown>> = [];

      try {
        return await work({
          session: null,
          isAtomic: false,
          compensate: (_describe: string, undo: () => Promise<unknown>) => compensations.push(undo),
        });
      } catch (error) {
        for (const undo of [...compensations].reverse()) await undo();
        throw error;
      }
    }),
  } as unknown as TransactionRunner;

  beforeEach(() => {
    jest.clearAllMocks();

    orderModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }),
      deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
    };

    checkoutService = { validate: jest.fn().mockResolvedValue(draft()) };
    inventoryService = {
      tryReserve: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    };
    paymentsService = {
      createForOrder: jest.fn().mockResolvedValue({
        method: PaymentMethod.CASH_ON_DELIVERY,
        status: PaymentStatus.PENDING,
        amount: 680,
        currency: 'PKR',
        paidAt: null,
      }),
      removeForOrder: jest.fn().mockResolvedValue(undefined),
      markPaid: jest.fn().mockResolvedValue(new Date()),
      markFailedForCancellation: jest.fn().mockResolvedValue(undefined),
    };
    cartService = { removePurchasedItems: jest.fn().mockResolvedValue(undefined) };
    // Store-facing reads project the account to name + phone; customer-facing
    // reads never touch it.
    userModel = {
      find: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
      }),
    };
    // Only read by `applySubstitution`, which these tests do not exercise.
    productModel = {
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
    };
    idempotencyService = {
      claim: jest.fn().mockResolvedValue({ kind: 'CLAIMED' }),
      complete: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(
      orderModel as unknown as Model<OrderDocument>,
      userModel as unknown as Model<UserDocument>,
      productModel as unknown as Model<ProductDocument>,
      checkoutService as unknown as CheckoutService,
      inventoryService as unknown as InventoryService,
      paymentsService as unknown as PaymentsService,
      cartService as unknown as CartService,
      { next: jest.fn().mockResolvedValue('FC-2026-0000001') } as unknown as OrderNumberService,
      idempotencyService as unknown as IdempotencyService,
      {
        findActiveStore: jest.fn().mockResolvedValue({ name: 'FreshCarts Gulberg' }),
      } as unknown as StoresService,
      compensatingRunner,
    );
  });

  const stubCreatedOrder = (document = orderDocument()) => {
    orderModel.create.mockResolvedValue([document]);
    return document;
  };

  const stubOwnedOrder = (document: Record<string, unknown>) => {
    orderModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(document) }),
    });
  };

  describe('create — the happy path', () => {
    it('revalidates the checkout rather than trusting the preview', async () => {
      stubCreatedOrder();
      stubOwnedOrder(orderDocument());

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      // §32: the preview is never load-bearing. Stock and prices move between
      // the shopper reviewing and the shopper tapping.
      expect(checkoutService.validate).toHaveBeenCalledWith(USER_ID, {
        fulfillmentMethod: FulfillmentMethod.PICKUP,
        addressId: undefined,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });
    });

    it('performs the steps in the order that cannot strand state', async () => {
      const sequence: string[] = [];
      inventoryService.tryReserve.mockImplementation(async () => {
        sequence.push('reserve');
        return true;
      });
      orderModel.create.mockImplementation(async () => {
        sequence.push('order');
        return [orderDocument()];
      });
      paymentsService.createForOrder.mockImplementation(async () => {
        sequence.push('payment');
        return {
          method: PaymentMethod.CASH_ON_DELIVERY,
          status: PaymentStatus.PENDING,
          amount: 680,
          currency: 'PKR',
          paidAt: null,
        };
      });
      cartService.removePurchasedItems.mockImplementation(async () => {
        sequence.push('cart');
      });

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      // Stock before the order (a shortage costs nothing to abandon), and the
      // cart last (§13: a failure must leave the basket usable).
      expect(sequence).toEqual(['reserve', 'order', 'payment', 'cart']);
    });

    it('snapshots every line from the draft, never from a live product', async () => {
      stubCreatedOrder();

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      const written = orderModel.create.mock.calls[0][0][0] as {
        items: Array<Record<string, unknown>>;
        pricing: Record<string, number>;
        status: OrderStatus;
        statusHistory: unknown[];
      };

      expect(written.items[0]).toMatchObject({
        productName: 'Milk 1L',
        sku: 'MILK-1L',
        unitLabel: '1 L',
        quantity: 2,
        unitPrice: 340,
        lineTotal: 680,
      });
      expect(written.pricing).toMatchObject({ subtotal: 680, deliveryFee: 0, total: 680 });
      expect(written.status).toBe(OrderStatus.PENDING);
      expect(written.statusHistory).toHaveLength(1);
    });

    it('opens a COD payment as PENDING — placing an order is not paying for it', async () => {
      stubCreatedOrder();

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      const written = orderModel.create.mock.calls[0][0][0] as {
        payment: { status: PaymentStatus };
      };
      expect(written.payment.status).toBe(PaymentStatus.PENDING);
      expect(paymentsService.createForOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 680 }),
        null,
      );
    });

    it('removes exactly the purchased lines, not the whole cart', async () => {
      stubCreatedOrder();

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      // No session: the cart is tidied after the unit of work has committed,
      // because it is not part of the order's atomic fact.
      expect(cartService.removePurchasedItems).toHaveBeenCalledWith(USER_ID, STORE_ID, [MILK]);
    });

    it('keeps the order when the cart cannot be tidied', async () => {
      stubCreatedOrder();
      stubOwnedOrder(orderDocument());
      cartService.removePurchasedItems.mockRejectedValue(new Error('cart write failed'));

      // Losing a real order because a basket could not be emptied would be a
      // far worse outcome than a cart still showing lines already bought — and
      // that state self-heals, since the cart is rebuilt from the catalogue on
      // every read and checkout re-validates from scratch.
      const order = await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      expect(order.orderNumber).toBe('FC-2026-0000001');
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
      expect(inventoryService.release).not.toHaveBeenCalled();
      expect(idempotencyService.complete).toHaveBeenCalled();
    });
  });

  describe('create — inventory', () => {
    it('takes stock for every line', async () => {
      checkoutService.validate.mockResolvedValue(
        draft({
          lines: [
            { ...draft().lines[0] },
            { ...draft().lines[0], productId: EGGS, sku: 'EGG-12', quantity: 1, lineTotal: 340 },
          ],
        }),
      );
      stubCreatedOrder();

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      expect(inventoryService.tryReserve).toHaveBeenCalledWith(MILK, STORE_ID, 2, null);
      expect(inventoryService.tryReserve).toHaveBeenCalledWith(EGGS, STORE_ID, 1, null);
    });

    it('returns stock already taken when a later line cannot be reserved', async () => {
      checkoutService.validate.mockResolvedValue(
        draft({
          lines: [
            { ...draft().lines[0] },
            {
              ...draft().lines[0],
              productId: EGGS,
              productName: 'Eggs',
              sku: 'EGG-12',
              quantity: 1,
              lineTotal: 340,
            },
          ],
        }),
      );
      inventoryService.tryReserve.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await expect(
        service.create(
          USER_ID,
          {
            fulfillmentMethod: FulfillmentMethod.PICKUP,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          },
          KEY,
        ),
      ).rejects.toBeInstanceOf(BusinessException);

      // The milk taken for line one goes back; nothing is stranded.
      expect(inventoryService.release).toHaveBeenCalledWith(MILK, STORE_ID, 2);
      // And no order exists claiming stock that was never deducted.
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('names the product that sold out, because "something sold out" is not actionable', async () => {
      inventoryService.tryReserve.mockResolvedValue(false);

      try {
        await service.create(
          USER_ID,
          {
            fulfillmentMethod: FulfillmentMethod.PICKUP,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          },
          KEY,
        );
        fail('expected order creation to be refused');
      } catch (error) {
        expect((error as BusinessException).message).toContain('Milk 1L');
        expect((error as BusinessException).code).toBe(ErrorCode.CHECKOUT_VALIDATION_FAILED);
      }
    });

    it('rolls stock and the order back when the payment record fails', async () => {
      stubCreatedOrder();
      paymentsService.createForOrder.mockRejectedValue(new Error('payment write failed'));

      await expect(
        service.create(
          USER_ID,
          {
            fulfillmentMethod: FulfillmentMethod.PICKUP,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          },
          KEY,
        ),
      ).rejects.toThrow('payment write failed');

      expect(orderModel.deleteOne).toHaveBeenCalledWith({ _id: ORDER_ID });
      expect(inventoryService.release).toHaveBeenCalledWith(MILK, STORE_ID, 2);
      // The basket survives a failed attempt.
      expect(cartService.removePurchasedItems).not.toHaveBeenCalled();
    });
  });

  describe('create — idempotency', () => {
    it('claims the key before doing any work', async () => {
      stubCreatedOrder();

      await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      expect(idempotencyService.claim).toHaveBeenCalledWith(USER_ID, 'order.create', KEY);
      expect(idempotencyService.complete).toHaveBeenCalledWith(
        USER_ID,
        'order.create',
        KEY,
        ORDER_ID,
      );
    });

    it('replays the original order instead of creating a second one', async () => {
      idempotencyService.claim.mockResolvedValue({ kind: 'REPLAY', resultId: ORDER_ID });
      stubOwnedOrder(orderDocument());

      const replayed = await service.create(
        USER_ID,
        {
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        },
        KEY,
      );

      expect(replayed.orderNumber).toBe('FC-2026-0000001');
      // Nothing runs on a replay: no validation, no stock, no second order.
      expect(checkoutService.validate).not.toHaveBeenCalled();
      expect(inventoryService.tryReserve).not.toHaveBeenCalled();
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('releases the claim when the attempt fails, so a retry is possible', async () => {
      checkoutService.validate.mockRejectedValue(BusinessException.cartEmpty());

      await expect(
        service.create(
          USER_ID,
          {
            fulfillmentMethod: FulfillmentMethod.PICKUP,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          },
          KEY,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.CART_EMPTY });

      expect(idempotencyService.release).toHaveBeenCalledWith(USER_ID, 'order.create', KEY);
      expect(idempotencyService.complete).not.toHaveBeenCalled();
    });

    it('lets a duplicate claim refuse the request outright', async () => {
      idempotencyService.claim.mockRejectedValue(BusinessException.duplicateRequest());

      await expect(
        service.create(
          USER_ID,
          {
            fulfillmentMethod: FulfillmentMethod.PICKUP,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          },
          KEY,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.DUPLICATE_REQUEST });

      expect(orderModel.create).not.toHaveBeenCalled();
    });
  });

  describe('reads and ownership', () => {
    it('scopes an order read by the authenticated user', async () => {
      stubOwnedOrder(orderDocument());

      await service.findForCustomer(USER_ID, ORDER_ID.toString());

      expect(orderModel.findOne).toHaveBeenCalledWith({
        _id: ORDER_ID,
        userId: new Types.ObjectId(USER_ID),
      });
    });

    it('reports another shopper’s order as missing', async () => {
      orderModel.findOne.mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });

      await expect(
        service.findForCustomer('64b000000000000000000010', ORDER_ID.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a malformed order id without a database round trip', async () => {
      await expect(service.findForCustomer(USER_ID, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(orderModel.findOne).not.toHaveBeenCalled();
    });

    it('always paginates the history', async () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      orderModel.find.mockReturnValue(chain);

      await service.listForCustomer(
        USER_ID,
        Object.assign(new (class {})(), {
          page: 2,
          limit: 20,
          skip: 20,
        }) as never,
      );

      expect(chain.skip).toHaveBeenCalledWith(20);
      expect(chain.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('cancellation', () => {
    function stubForCancellation(status: OrderStatus) {
      const document = orderDocument({ status });
      stubOwnedOrder(document);
      orderModel.findById.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(document) }),
      });
      return document;
    }

    it('cancels a pending order and returns the stock exactly once', async () => {
      const document = stubForCancellation(OrderStatus.PENDING);

      await service.cancelForCustomer(USER_ID, ORDER_ID.toString(), 'Changed my mind');

      expect(document.status).toBe(OrderStatus.CANCELLED);
      expect(document.inventoryRestored).toBe(true);
      expect(inventoryService.release).toHaveBeenCalledWith(MILK, STORE_ID, 2, null);
      expect(paymentsService.markFailedForCancellation).toHaveBeenCalled();
    });

    it('records who cancelled and why', async () => {
      const document = stubForCancellation(OrderStatus.CONFIRMED);

      await service.cancelForCustomer(USER_ID, ORDER_ID.toString(), 'Ordered by mistake');

      expect(document.cancellationReason).toBe('Ordered by mistake');
      expect(document.cancelledByRole).toBe('CUSTOMER');
      expect(document.cancelledAt).toBeInstanceOf(Date);
      expect((document.statusHistory as unknown[]).length).toBe(1);
    });

    it('refuses once the store has started picking', async () => {
      stubForCancellation(OrderStatus.PREPARING);

      await expect(service.cancelForCustomer(USER_ID, ORDER_ID.toString())).rejects.toMatchObject({
        code: ErrorCode.ORDER_NOT_CANCELLABLE,
      });

      expect(inventoryService.release).not.toHaveBeenCalled();
    });

    it('refuses to cancel a delivered order', async () => {
      stubForCancellation(OrderStatus.DELIVERED);

      await expect(service.cancelForCustomer(USER_ID, ORDER_ID.toString())).rejects.toMatchObject({
        code: ErrorCode.ORDER_NOT_CANCELLABLE,
      });
    });

    it('does not return stock twice on a repeated cancellation', async () => {
      const document = orderDocument({
        status: OrderStatus.PENDING,
        inventoryRestored: true,
      });
      orderModel.findById.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(document) }),
      });

      // The flag, not the status, is what makes restoration exactly-once.
      await service.changeStatus(ORDER_ID, OrderStatus.CANCELLED, { actor: 'SYSTEM' });

      expect(inventoryService.release).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    function stubOrderFor(status: OrderStatus, method = FulfillmentMethod.PICKUP) {
      const document = orderDocument({ status, fulfillmentMethod: method });
      orderModel.findById.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(document) }),
      });
      return document;
    }

    it('validates the transition against the machine', async () => {
      stubOrderFor(OrderStatus.PENDING);

      await expect(
        service.changeStatus(ORDER_ID, OrderStatus.DELIVERED, { actor: 'SYSTEM' }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATUS_TRANSITION });
    });

    it('refuses OUT_FOR_DELIVERY on a pickup order', async () => {
      stubOrderFor(OrderStatus.PACKED, FulfillmentMethod.PICKUP);

      await expect(
        service.changeStatus(ORDER_ID, OrderStatus.OUT_FOR_DELIVERY, { actor: 'SYSTEM' }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATUS_TRANSITION });
    });

    it('refuses READY_FOR_PICKUP on a delivery order', async () => {
      stubOrderFor(OrderStatus.PACKED, FulfillmentMethod.DELIVERY);

      await expect(
        service.changeStatus(ORDER_ID, OrderStatus.READY_FOR_PICKUP, { actor: 'SYSTEM' }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATUS_TRANSITION });
    });

    it('settles the cash payment only on completion', async () => {
      const document = stubOrderFor(OrderStatus.READY_FOR_PICKUP, FulfillmentMethod.PICKUP);

      await service.changeStatus(ORDER_ID, OrderStatus.DELIVERED, { actor: 'SYSTEM' });

      // §29: COD becomes PAID when the money arrives, not when the order was placed.
      expect(paymentsService.markPaid).toHaveBeenCalled();
      expect((document.payment as { status: PaymentStatus }).status).toBe(PaymentStatus.PAID);
    });

    it('appends to the history rather than replacing it', async () => {
      const document = stubOrderFor(OrderStatus.PENDING);

      await service.changeStatus(ORDER_ID, OrderStatus.CONFIRMED, {
        actor: 'SYSTEM',
        note: 'Confirmed automatically',
      });

      const history = document.statusHistory as Array<Record<string, unknown>>;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        status: OrderStatus.CONFIRMED,
        note: 'Confirmed automatically',
        changedByRole: 'SYSTEM',
      });
    });

    it('reports a missing order rather than creating one', async () => {
      orderModel.findById.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(null) }),
      });

      await expect(
        service.changeStatus(ORDER_ID, OrderStatus.CONFIRMED, { actor: 'SYSTEM' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
