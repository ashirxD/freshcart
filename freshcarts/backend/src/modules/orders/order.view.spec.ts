import { Types } from 'mongoose';
import { UnitType } from 'src/common/enums';
import { PaymentMethod, PaymentStatus } from 'src/modules/payments/enums';
import { FulfillmentMethod, OrderStatus } from './order-status.machine';
import { LeanOrder, buildTimeline, statusLabel, toOrderDetailView } from './order.view';

const AT = (iso: string) => new Date(iso);

function order(overrides: Partial<LeanOrder> = {}): LeanOrder {
  return {
    _id: new Types.ObjectId('64b0000000000000000000f1'),
    orderNumber: 'FC-2026-0001482',
    userId: new Types.ObjectId('64b000000000000000000009'),
    storeId: new Types.ObjectId('64b000000000000000000001'),
    items: [
      {
        productId: new Types.ObjectId('64b000000000000000000101'),
        productName: 'Milk 1L',
        productImage: null,
        brand: 'Olper’s',
        sku: 'MILK-1L',
        unitLabel: '1 L',
        unitType: UnitType.LITER,
        unitValue: 1,
        quantity: 2,
        unitPrice: 340,
        lineTotal: 680,
      },
    ],
    fulfillmentMethod: FulfillmentMethod.DELIVERY,
    deliveryAddress: {
      addressId: new Types.ObjectId('64b0000000000000000000a1'),
      label: 'HOME',
      recipientName: 'Ayesha Khan',
      phone: '+923001234569',
      houseNumber: '42-B',
      street: 'Street 4',
      area: 'Salamatpura',
      city: 'Lahore',
      landmark: null,
      deliveryInstructions: 'Ring twice',
      latitude: 31.545,
      longitude: 74.372,
      formatted: '42-B, Street 4, Salamatpura, Lahore',
    },
    delivery: {
      distanceMeters: 4_300,
      durationSeconds: 900,
      fee: 120,
      pricingRuleId: null,
      pricingRuleLabel: 'Short',
      routingProvider: 'osrm',
      calculatedAt: AT('2026-02-01T10:00:00Z'),
    },
    pickup: null,
    pricing: { subtotal: 680, deliveryFee: 120, discount: 0, total: 800, currency: 'PKR' },
    payment: {
      method: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.PENDING,
      paidAt: null,
    },
    status: OrderStatus.PENDING,
    statusHistory: [
      {
        status: OrderStatus.PENDING,
        changedAt: AT('2026-02-01T10:00:00Z'),
        changedByRole: 'CUSTOMER',
        changedByUserId: null,
        note: 'Order placed and waiting for the store to confirm.',
      },
    ],
    customerNote: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledByRole: null,
    inventoryRestored: false,
    createdAt: AT('2026-02-01T10:00:00Z'),
    updatedAt: AT('2026-02-01T10:00:00Z'),
    ...overrides,
  } as LeanOrder;
}

function advance(base: LeanOrder, ...statuses: OrderStatus[]): LeanOrder {
  let clock = 10;

  return {
    ...base,
    status: statuses[statuses.length - 1],
    statusHistory: [
      ...base.statusHistory,
      ...statuses.map((status) => ({
        status,
        changedAt: AT('2026-02-01T' + String((clock += 1)).padStart(2, '0') + ':00:00Z'),
        changedByRole: 'STORE_MANAGER',
        changedByUserId: null,
        note: 'moved to ' + status,
      })),
    ],
  } as LeanOrder;
}

describe('order view', () => {
  describe('buildTimeline', () => {
    it('marks the current step from the recorded status, never a hardcoded index', () => {
      const timeline = buildTimeline(
        advance(order(), OrderStatus.CONFIRMED, OrderStatus.PREPARING),
      );

      expect(timeline.map((step) => [step.status, step.isComplete, step.isCurrent])).toEqual([
        [OrderStatus.PENDING, true, false],
        [OrderStatus.CONFIRMED, true, false],
        [OrderStatus.PREPARING, false, true],
        [OrderStatus.PACKED, false, false],
        [OrderStatus.OUT_FOR_DELIVERY, false, false],
        [OrderStatus.DELIVERED, false, false],
      ]);
    });

    it('shows the delivery journey for a delivery order', () => {
      const timeline = buildTimeline(order());

      expect(timeline.map((step) => step.status)).toContain(OrderStatus.OUT_FOR_DELIVERY);
      expect(timeline.map((step) => step.status)).not.toContain(OrderStatus.READY_FOR_PICKUP);
    });

    it('shows the pickup journey for a pickup order', () => {
      const timeline = buildTimeline(
        order({
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          deliveryAddress: null,
          delivery: null,
        }),
      );

      expect(timeline.map((step) => step.status)).toContain(OrderStatus.READY_FOR_PICKUP);
      expect(timeline.map((step) => step.status)).not.toContain(OrderStatus.OUT_FOR_DELIVERY);
    });

    it('carries the timestamp and note from the history onto each reached step', () => {
      const timeline = buildTimeline(advance(order(), OrderStatus.CONFIRMED));

      expect(timeline[0].changedAt).toEqual(AT('2026-02-01T10:00:00Z'));
      expect(timeline[0].note).toContain('Order placed');
      // Steps still ahead make no claim about when they happened.
      expect(timeline[3].changedAt).toBeNull();
    });

    it('appends a cancellation as the step the order actually rests on', () => {
      const cancelled = advance(order(), OrderStatus.CANCELLED);
      const timeline = buildTimeline(cancelled);

      const last = timeline[timeline.length - 1];
      expect(last.status).toBe(OrderStatus.CANCELLED);
      expect(last.isCurrent).toBe(true);

      // Nothing on the happy path is claimed as current once the order is dead.
      expect(timeline.filter((step) => step.isCurrent)).toHaveLength(1);
    });

    it('marks every step complete on a finished order', () => {
      const delivered = advance(
        order(),
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.PACKED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
      );

      const timeline = buildTimeline(delivered);
      expect(timeline[timeline.length - 1].isCurrent).toBe(true);
      expect(timeline.slice(0, -1).every((step) => step.isComplete)).toBe(true);
    });
  });

  describe('statusLabel', () => {
    it('calls a completed pickup "Collected", not "Delivered"', () => {
      // Same terminal state, honest wording for each journey.
      expect(statusLabel(OrderStatus.DELIVERED, FulfillmentMethod.PICKUP)).toBe('Collected');
      expect(statusLabel(OrderStatus.DELIVERED, FulfillmentMethod.DELIVERY)).toBe('Delivered');
    });
  });

  describe('toOrderDetailView', () => {
    it('renders from the snapshot, so it needs no live product', () => {
      const view = toOrderDetailView(order(), 'FreshCarts Gulberg');

      expect(view.items[0]).toMatchObject({
        productName: 'Milk 1L',
        unitPrice: 340,
        lineTotal: 680,
      });
      expect(view.pricing).toEqual({
        subtotal: 680,
        deliveryFee: 120,
        discount: 0,
        total: 800,
        currency: 'PKR',
      });
    });

    it('keeps the audit trail internal: history without who did it', () => {
      const view = toOrderDetailView(advance(order(), OrderStatus.CONFIRMED));

      expect(view.statusHistory[0]).toEqual({
        status: OrderStatus.PENDING,
        changedAt: AT('2026-02-01T10:00:00Z'),
        note: expect.any(String),
      });

      // changedByRole / changedByUserId stay server-side.
      expect(JSON.stringify(view.statusHistory)).not.toContain('changedByRole');
    });

    it('offers cancellation only while the store has not started picking', () => {
      expect(toOrderDetailView(order()).canCancel).toBe(true);
      expect(
        toOrderDetailView(advance(order(), OrderStatus.CONFIRMED, OrderStatus.PREPARING)).canCancel,
      ).toBe(false);
    });

    it('shows pickup details and no delivery block for a pickup order', () => {
      const view = toOrderDetailView(
        order({
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          deliveryAddress: null,
          delivery: null,
          pricing: { subtotal: 680, deliveryFee: 0, discount: 0, total: 680, currency: 'PKR' },
          pickup: {
            storeName: 'FreshCarts Gulberg',
            storeAddress: 'Shop 12, Gulberg III, Lahore',
            storePhone: '+923004567890',
            latitude: 31.5102,
            longitude: 74.3441,
            instructions: 'Bring your order number.',
          },
        }),
      );

      expect(view.delivery).toBeNull();
      expect(view.deliveryAddress).toBeNull();
      expect(view.pickup?.storeName).toBe('FreshCarts Gulberg');
      expect(view.pricing.deliveryFee).toBe(0);
    });
  });
});
