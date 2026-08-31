import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { TransactionRunner } from 'src/common/database';
import { IdempotencyService } from 'src/common/idempotency';
import { Role } from 'src/common/enums';
import { CartService } from 'src/modules/cart/cart.service';
import { CheckoutService } from 'src/modules/checkout';
import { InventoryService } from 'src/modules/inventory';
import { PaymentsService } from 'src/modules/payments';
import { ProductDocument } from 'src/modules/products/schemas';
import { StoresService } from 'src/modules/stores';
import { UserDocument } from 'src/modules/users/schemas';
import { OrderNumberService } from './order-number.service';
import { FulfillmentMethod, OrderStatus } from './order-status.machine';
import { OrdersService } from './orders.service';
import { OrderDocument } from './schemas';

const STORE_A = new Types.ObjectId('64b000000000000000000001');
const STORE_B = new Types.ObjectId('64b000000000000000000002');
const ORDER_ID = new Types.ObjectId('64b000000000000000000101');
const CUSTOMER_ID = new Types.ObjectId('64b000000000000000000009');
const MANAGER_ID = '64b00000000000000000000a';

type MockModel = Record<string, jest.Mock>;

function chain<T>(result: T) {
  const query = {
    find: () => query,
    select: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => query,
    session: () => query,
    exec: () => Promise.resolve(result),
  };
  return query;
}

function leanOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: ORDER_ID,
    orderNumber: 'FC-2026-0000001',
    userId: CUSTOMER_ID,
    storeId: STORE_A,
    items: [],
    fulfillmentMethod: FulfillmentMethod.DELIVERY,
    deliveryAddress: null,
    delivery: null,
    pickup: null,
    pricing: { subtotal: 480, deliveryFee: 0, discount: 0, total: 480, currency: 'PKR' },
    payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING', paidAt: null },
    status: OrderStatus.PENDING,
    statusHistory: [],
    customerNote: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledByRole: null,
    inventoryRestored: false,
    createdAt: new Date('2026-08-31T10:00:00Z'),
    updatedAt: new Date('2026-08-31T10:00:00Z'),
    ...overrides,
  };
}

/**
 * The store-facing half of OrdersService.
 *
 * The assertions that matter most here are about the *query filter*: store
 * ownership has to be part of the lookup rather than a check afterwards, because
 * that is what makes cross-store access impossible instead of merely guarded.
 */
describe('OrdersService — store operations', () => {
  let orderModel: MockModel;
  let userModel: MockModel;
  let service: OrdersService;
  let changeStatus: jest.SpyInstance;

  beforeEach(() => {
    orderModel = {
      find: jest.fn().mockReturnValue(chain([])),
      findOne: jest.fn().mockReturnValue(chain(null)),
      findById: jest.fn().mockReturnValue(chain(null)),
      countDocuments: jest.fn().mockReturnValue(chain(0)),
      aggregate: jest.fn().mockReturnValue(chain([])),
    };

    userModel = { find: jest.fn().mockReturnValue(chain([])) };

    service = new OrdersService(
      orderModel as unknown as Model<OrderDocument>,
      userModel as unknown as Model<UserDocument>,
      { findOne: jest.fn().mockReturnValue(chain(null)) } as unknown as Model<ProductDocument>,
      {} as unknown as CheckoutService,
      {} as unknown as InventoryService,
      {} as unknown as PaymentsService,
      {} as unknown as CartService,
      {} as unknown as OrderNumberService,
      {} as unknown as IdempotencyService,
      {
        findActiveStore: jest.fn().mockResolvedValue({ name: 'FreshCarts Gulberg' }),
      } as unknown as StoresService,
      {} as unknown as TransactionRunner,
    );

    // The transition rules belong to `changeStatus`, which has its own suite.
    // These tests are about what happens *before* it is reached.
    changeStatus = jest
      .spyOn(service, 'changeStatus')
      .mockResolvedValue(leanOrder({ status: OrderStatus.CONFIRMED }) as never);
  });

  describe('listForStore', () => {
    it('puts the store in the filter, not in a check afterwards', async () => {
      await service.listForStore(STORE_A, { page: 1, limit: 20, skip: 0 } as never);

      const [filter] = orderModel.find.mock.calls[0];
      expect(filter.storeId).toEqual(STORE_A);
    });

    it('narrows to a single status when asked', async () => {
      await service.listForStore(STORE_A, {
        page: 1,
        limit: 20,
        skip: 0,
        status: OrderStatus.PREPARING,
      } as never);

      expect(orderModel.find.mock.calls[0][0]).toMatchObject({
        storeId: STORE_A,
        status: OrderStatus.PREPARING,
      });
    });

    it('derives the needs-action filter from the state machine', async () => {
      await service.listForStore(STORE_A, {
        page: 1,
        limit: 20,
        skip: 0,
        needsAction: true,
      } as never);

      const [filter] = orderModel.find.mock.calls[0];
      expect(filter.status.$in).toEqual([
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.PACKED,
      ]);
    });

    it('escapes an order-number search', async () => {
      await service.listForStore(STORE_A, {
        page: 1,
        limit: 20,
        skip: 0,
        orderNumber: 'FC-2026(1',
      } as never);

      const [filter] = orderModel.find.mock.calls[0];
      // Unescaped, the bracket would be a group — a wrong result and a ReDoS risk.
      expect((filter.orderNumber as RegExp).source).toContain('\\(');
      expect((filter.orderNumber as RegExp).source.startsWith('^')).toBe(true);
    });

    it('applies both date bounds', async () => {
      const from = new Date('2026-08-01T00:00:00Z');
      const to = new Date('2026-08-31T23:59:59Z');

      await service.listForStore(STORE_A, {
        page: 1,
        limit: 20,
        skip: 0,
        placedFrom: from,
        placedTo: to,
      } as never);

      expect(orderModel.find.mock.calls[0][0].createdAt).toEqual({ $gte: from, $lte: to });
    });

    it('sorts action-required orders to the top of the page', async () => {
      orderModel.find.mockReturnValue(
        chain([
          leanOrder({ _id: new Types.ObjectId(), status: OrderStatus.OUT_FOR_DELIVERY }),
          leanOrder({ _id: new Types.ObjectId(), status: OrderStatus.PENDING }),
        ]),
      );
      orderModel.countDocuments.mockReturnValue(chain(2));

      const result = await service.listForStore(STORE_A, {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);

      expect(result.items[0].status).toBe(OrderStatus.PENDING);
      expect(result.items[0].needsAction).toBe(true);
    });

    it('reads the customer identity once per page, not once per order', async () => {
      orderModel.find.mockReturnValue(
        chain([
          leanOrder({ _id: new Types.ObjectId() }),
          leanOrder({ _id: new Types.ObjectId() }),
          leanOrder({ _id: new Types.ObjectId() }),
        ]),
      );

      await service.listForStore(STORE_A, { page: 1, limit: 20, skip: 0 } as never);

      expect(userModel.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('findForStore', () => {
    it('scopes the lookup by store', async () => {
      orderModel.findOne.mockReturnValue(chain(leanOrder()));

      await service.findForStore(STORE_A, ORDER_ID.toHexString());

      expect(orderModel.findOne).toHaveBeenCalledWith({ _id: ORDER_ID, storeId: STORE_A });
    });

    it("reports another store's order as not found, not as forbidden", async () => {
      // The filter simply does not match, so the distinction never leaks.
      orderModel.findOne.mockReturnValue(chain(null));

      await expect(service.findForStore(STORE_B, ORDER_ID.toHexString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a malformed id without a database round trip', async () => {
      await expect(service.findForStore(STORE_A, 'nonsense')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(orderModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('advanceForStore', () => {
    beforeEach(() => {
      orderModel.findOne.mockReturnValue(chain(leanOrder()));
    });

    it('establishes store ownership before writing anything', async () => {
      orderModel.findOne.mockReturnValue(chain(null));

      await expect(
        service.advanceForStore(STORE_B, ORDER_ID.toHexString(), OrderStatus.CONFIRMED, {
          userId: MANAGER_ID,
          role: Role.STORE_MANAGER,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(changeStatus).not.toHaveBeenCalled();
    });

    it('delegates the transition to changeStatus rather than re-deciding it', async () => {
      await service.advanceForStore(STORE_A, ORDER_ID.toHexString(), OrderStatus.CONFIRMED, {
        userId: MANAGER_ID,
        role: Role.STORE_MANAGER,
      });

      expect(changeStatus).toHaveBeenCalledWith(
        ORDER_ID,
        OrderStatus.CONFIRMED,
        expect.objectContaining({
          actor: Role.STORE_MANAGER,
          actorId: new Types.ObjectId(MANAGER_ID),
        }),
      );
    });

    it('attributes the change to the authenticated principal', async () => {
      await service.advanceForStore(STORE_A, ORDER_ID.toHexString(), OrderStatus.CONFIRMED, {
        userId: MANAGER_ID,
        role: Role.STORE_MANAGER,
      });

      const [, , options] = changeStatus.mock.calls[0];
      expect(options.actorId).toEqual(new Types.ObjectId(MANAGER_ID));
    });

    it('requires a reason to reject', async () => {
      await expect(
        service.advanceForStore(STORE_A, ORDER_ID.toHexString(), OrderStatus.REJECTED, {
          userId: MANAGER_ID,
          role: Role.STORE_MANAGER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(changeStatus).not.toHaveBeenCalled();
    });

    it('requires a reason to cancel or fail', async () => {
      for (const status of [OrderStatus.CANCELLED, OrderStatus.FAILED]) {
        await expect(
          service.advanceForStore(STORE_A, ORDER_ID.toHexString(), status, {
            userId: MANAGER_ID,
            role: Role.STORE_MANAGER,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('passes the reason through as both the note and the cancellation reason', async () => {
      await service.advanceForStore(
        STORE_A,
        ORDER_ID.toHexString(),
        OrderStatus.CANCELLED,
        { userId: MANAGER_ID, role: Role.STORE_MANAGER },
        { reason: 'Fridge failure overnight' },
      );

      const [, , options] = changeStatus.mock.calls[0];
      // The shopper reads the note, so the reason has to reach it.
      expect(options.note).toBe('Fridge failure overnight');
      expect(options.cancellationReason).toBe('Fridge failure overnight');
    });

    it('needs no reason for a forward step', async () => {
      await expect(
        service.advanceForStore(STORE_A, ORDER_ID.toHexString(), OrderStatus.PREPARING, {
          userId: MANAGER_ID,
          role: Role.STORE_MANAGER,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('dashboardCountsForStore', () => {
    it('asks the database once, scoped to the store', async () => {
      orderModel.aggregate.mockReturnValue(
        chain([
          { byStatus: [{ _id: OrderStatus.PENDING, count: 5 }], completedToday: [{ value: 18 }] },
        ]),
      );

      const counts = await service.dashboardCountsForStore(STORE_A);

      expect(orderModel.aggregate).toHaveBeenCalledTimes(1);
      const [pipeline] = orderModel.aggregate.mock.calls[0];
      expect(pipeline[0].$match).toEqual({ storeId: STORE_A });
      expect(counts.byStatus[OrderStatus.PENDING]).toBe(5);
      expect(counts.completedToday).toBe(18);
    });

    it('reports zero for every status the store has none of', async () => {
      orderModel.aggregate.mockReturnValue(chain([{ byStatus: [], completedToday: [] }]));

      const counts = await service.dashboardCountsForStore(STORE_A);

      for (const status of Object.values(OrderStatus)) {
        expect(counts.byStatus[status]).toBe(0);
      }
      expect(counts.completedToday).toBe(0);
      expect(counts.needsAction).toBe(0);
    });

    it('sums needs-action from the state machine list, not a hardcoded one', async () => {
      orderModel.aggregate.mockReturnValue(
        chain([
          {
            byStatus: [
              { _id: OrderStatus.PENDING, count: 5 },
              { _id: OrderStatus.CONFIRMED, count: 3 },
              { _id: OrderStatus.PREPARING, count: 4 },
              { _id: OrderStatus.PACKED, count: 2 },
              // Neither of these is the store's move.
              { _id: OrderStatus.OUT_FOR_DELIVERY, count: 3 },
              { _id: OrderStatus.DELIVERED, count: 40 },
            ],
            completedToday: [{ value: 18 }],
          },
        ]),
      );

      const counts = await service.dashboardCountsForStore(STORE_A);

      expect(counts.needsAction).toBe(14);
    });

    it('measures "today" from the start of the local day', async () => {
      orderModel.aggregate.mockReturnValue(chain([{ byStatus: [], completedToday: [] }]));

      await service.dashboardCountsForStore(STORE_A, new Date('2026-08-31T19:30:00Z'));

      const [pipeline] = orderModel.aggregate.mock.calls[0];
      const branch = pipeline[1].$facet.completedToday[0].$match;

      expect(branch.status).toBe(OrderStatus.DELIVERED);
      expect((branch.updatedAt.$gte as Date).getHours()).toBe(0);
    });
  });
});
