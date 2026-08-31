import { Types } from 'mongoose';
import { Role, UnitType } from 'src/common/enums';
import { PaymentMethod, PaymentStatus } from 'src/modules/payments/enums';
import { FulfillmentMethod, OrderStatus } from './order-status.machine';
import { LeanOrder } from './order.view';
import {
  actionsFor,
  needsAction,
  toStoreOrderDetailView,
  toStoreOrderSummaryView,
} from './store-order.view';

function buildOrder(overrides: Partial<LeanOrder> = {}): LeanOrder {
  return {
    _id: new Types.ObjectId('64b000000000000000000101'),
    orderNumber: 'FC-2026-0000001',
    userId: new Types.ObjectId('64b000000000000000000009'),
    storeId: new Types.ObjectId('64b000000000000000000001'),
    items: [
      {
        productId: new Types.ObjectId('64b000000000000000000201'),
        productName: "Olper's Full Cream Milk",
        productImage: null,
        brand: "Olper's",
        sku: 'FC-DAI-001',
        unitLabel: '1 L',
        unitType: UnitType.LITER,
        unitValue: 1,
        quantity: 2,
        unitPrice: 240,
        lineTotal: 480,
      },
    ],
    fulfillmentMethod: FulfillmentMethod.DELIVERY,
    deliveryAddress: {
      addressId: new Types.ObjectId('64b000000000000000000301'),
      label: 'HOME',
      recipientName: 'Ayesha Khan',
      phone: '+923001234569',
      houseNumber: '42-B',
      street: 'Street 4',
      area: 'Salamatpura',
      city: 'Lahore',
      landmark: 'Opposite Al-Fatah',
      deliveryInstructions: 'Ring the bell twice',
      latitude: 31.545,
      longitude: 74.372,
      formatted: '42-B, Street 4, Salamatpura, Lahore',
    },
    delivery: {
      distanceMeters: 4300,
      durationSeconds: 900,
      fee: 120,
      pricingRuleId: null,
      pricingRuleLabel: 'Up to 5 km',
      routingProvider: 'estimate',
      calculatedAt: new Date('2026-08-31T10:00:00Z'),
    },
    pickup: null,
    pricing: { subtotal: 480, deliveryFee: 120, discount: 0, total: 600, currency: 'PKR' },
    payment: {
      method: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.PENDING,
      paidAt: null,
    },
    status: OrderStatus.PENDING,
    statusHistory: [
      {
        status: OrderStatus.PENDING,
        changedAt: new Date('2026-08-31T10:00:00Z'),
        changedByRole: Role.CUSTOMER,
        changedByUserId: new Types.ObjectId('64b000000000000000000009'),
        note: 'Order placed and waiting for the store to confirm.',
      },
    ],
    customerNote: 'Please call on arrival',
    cancelledAt: null,
    cancellationReason: null,
    cancelledByRole: null,
    inventoryRestored: false,
    createdAt: new Date('2026-08-31T10:00:00Z'),
    updatedAt: new Date('2026-08-31T10:00:00Z'),
    ...overrides,
  } as LeanOrder;
}

function pickupOrder(status: OrderStatus): LeanOrder {
  return buildOrder({
    status,
    fulfillmentMethod: FulfillmentMethod.PICKUP,
    deliveryAddress: null,
    delivery: null,
    pickup: {
      storeName: 'FreshCarts Gulberg',
      storeAddress: 'Shop 12, Main Boulevard, Gulberg III, Lahore',
      storePhone: '+923004567890',
      latitude: 31.5102,
      longitude: 74.3441,
      instructions: null,
    },
    pricing: { subtotal: 480, deliveryFee: 0, discount: 0, total: 480, currency: 'PKR' },
  });
}

/**
 * The actions a store manager is offered.
 *
 * These are the tests that hold §13 and §45 in place: only valid actions, and
 * exactly one primary one. They deliberately assert against the *machine's*
 * behaviour rather than a hardcoded list, so a change to the state machine shows
 * up here rather than silently producing a button that 409s.
 */
describe('actionsFor', () => {
  it('offers confirm and reject on a pending order', () => {
    const actions = actionsFor(buildOrder({ status: OrderStatus.PENDING }));

    expect(actions.map((action) => action.action)).toEqual(['CONFIRM', 'REJECT']);
    expect(actions[0].intent).toBe('PRIMARY');
    expect(actions[1].intent).toBe('DESTRUCTIVE');
    expect(actions[1].requiresReason).toBe(true);
  });

  it('never offers more than one primary action', () => {
    for (const status of Object.values(OrderStatus)) {
      for (const method of Object.values(FulfillmentMethod)) {
        const actions = actionsFor({ status, fulfillmentMethod: method });
        const primary = actions.filter((action) => action.intent === 'PRIMARY');

        expect(primary.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('offers a packed DELIVERY order only the delivery lane', () => {
    const actions = actionsFor(buildOrder({ status: OrderStatus.PACKED }));

    expect(actions.map((action) => action.status)).toContain(OrderStatus.OUT_FOR_DELIVERY);
    expect(actions.map((action) => action.status)).not.toContain(OrderStatus.READY_FOR_PICKUP);
  });

  it('offers a packed PICKUP order only the pickup lane', () => {
    const actions = actionsFor(pickupOrder(OrderStatus.PACKED));

    expect(actions.map((action) => action.status)).toContain(OrderStatus.READY_FOR_PICKUP);
    expect(actions.map((action) => action.status)).not.toContain(OrderStatus.OUT_FOR_DELIVERY);
  });

  it('words the completion step for the lane it is in', () => {
    expect(
      actionsFor(buildOrder({ status: OrderStatus.OUT_FOR_DELIVERY })).map((a) => a.action),
    ).toContain('MARK_DELIVERED');

    expect(actionsFor(pickupOrder(OrderStatus.READY_FOR_PICKUP)).map((a) => a.action)).toContain(
      'COMPLETE_PICKUP',
    );
  });

  it('offers reject only from PENDING', () => {
    // Once a store has accepted an order, backing out is a cancellation — which
    // reads differently to the shopper and is recorded differently.
    for (const status of [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.PACKED]) {
      const actions = actionsFor(buildOrder({ status }));
      expect(actions.map((a) => a.status)).not.toContain(OrderStatus.REJECTED);
      expect(actions.map((a) => a.status)).toContain(OrderStatus.CANCELLED);
    }
  });

  it('offers "could not complete" only from the hand-over states', () => {
    expect(
      actionsFor(buildOrder({ status: OrderStatus.OUT_FOR_DELIVERY })).map((a) => a.status),
    ).toContain(OrderStatus.FAILED);

    expect(
      actionsFor(buildOrder({ status: OrderStatus.PENDING })).map((a) => a.status),
    ).not.toContain(OrderStatus.FAILED);
  });

  it('offers nothing on a terminal order', () => {
    for (const status of [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
      OrderStatus.FAILED,
    ]) {
      expect(actionsFor(buildOrder({ status }))).toEqual([]);
    }
  });

  it('requires a reason for every destructive action and none of the others', () => {
    for (const status of Object.values(OrderStatus)) {
      for (const action of actionsFor({ status, fulfillmentMethod: FulfillmentMethod.DELIVERY })) {
        expect(action.requiresReason).toBe(action.intent === 'DESTRUCTIVE');
      }
    }
  });
});

describe('needsAction', () => {
  it('counts the states the store is holding up', () => {
    expect(needsAction(OrderStatus.PENDING)).toBe(true);
    expect(needsAction(OrderStatus.CONFIRMED)).toBe(true);
    expect(needsAction(OrderStatus.PREPARING)).toBe(true);
    expect(needsAction(OrderStatus.PACKED)).toBe(true);
  });

  it('does not count an order that is with the rider or finished', () => {
    expect(needsAction(OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    expect(needsAction(OrderStatus.DELIVERED)).toBe(false);
    expect(needsAction(OrderStatus.CANCELLED)).toBe(false);
  });
});

/**
 * The privacy boundary (§12). These tests exist to make a leak fail loudly: the
 * store projection must carry what fulfilment needs and nothing else about the
 * customer's account.
 */
describe('the store projection', () => {
  it('exposes the fulfilment identity from the address snapshot', () => {
    const view = toStoreOrderSummaryView(buildOrder());

    // The recipient, not the account holder: it is who the bag is handed to.
    expect(view.customer).toEqual({ name: 'Ayesha Khan', phone: '+923001234569' });
  });

  it('falls back to the account for a pickup order, which has no snapshot', () => {
    const view = toStoreOrderSummaryView(pickupOrder(OrderStatus.CONFIRMED), {
      name: 'Bilal Ahmed',
      phone: '+923001234570',
    });

    expect(view.customer.name).toBe('Bilal Ahmed');
  });

  it('never carries the customer id, e-mail or any other account field', () => {
    const serialised = JSON.stringify(
      toStoreOrderDetailView(buildOrder(), { name: 'Ayesha Khan', phone: '+923001234569' }),
    );

    expect(serialised).not.toContain('userId');
    expect(serialised).not.toContain('64b000000000000000000009');
    expect(serialised).not.toContain('email');
    expect(serialised).not.toContain('preferredLanguage');
  });

  it('gives staff the full address, landmark, instructions and coordinates', () => {
    const view = toStoreOrderDetailView(buildOrder());

    expect(view.deliveryAddress).toMatchObject({
      area: 'Salamatpura',
      landmark: 'Opposite Al-Fatah',
      deliveryInstructions: 'Ring the bell twice',
      latitude: 31.545,
      longitude: 74.372,
    });
    expect(view.delivery).toMatchObject({ distanceMeters: 4300, fee: 120 });
  });

  it('shows staff who made each status change, unlike the customer view', () => {
    const view = toStoreOrderDetailView(buildOrder());

    expect(view.statusHistory[0].changedByRole).toBe(Role.CUSTOMER);
  });

  it('carries the pickup details instead for a collection order', () => {
    const view = toStoreOrderDetailView(pickupOrder(OrderStatus.PACKED));

    expect(view.deliveryAddress).toBeNull();
    expect(view.pickup?.storeName).toBe('FreshCarts Gulberg');
  });

  it('surfaces the single next action on a list row', () => {
    expect(
      toStoreOrderSummaryView(buildOrder({ status: OrderStatus.PREPARING })).nextAction,
    ).toMatchObject({ action: 'MARK_PACKED', intent: 'PRIMARY' });
  });

  it('reports a cancellation with its reason and who made it', () => {
    const view = toStoreOrderDetailView(
      buildOrder({
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date('2026-08-31T11:00:00Z'),
        cancellationReason: 'ITEMS_UNAVAILABLE: no stock',
        cancelledByRole: Role.STORE_MANAGER,
      }),
    );

    expect(view.cancellation).toMatchObject({
      reason: 'ITEMS_UNAVAILABLE: no stock',
      byRole: Role.STORE_MANAGER,
    });
  });
});
