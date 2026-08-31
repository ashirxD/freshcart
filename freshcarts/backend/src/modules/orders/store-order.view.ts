import { PaymentMethod, PaymentStatus } from 'src/modules/payments/enums';
import {
  FulfillmentMethod,
  OrderStatus,
  allowedNextStatuses,
  isTerminal,
} from './order-status.machine';
import { LeanOrder, statusLabel } from './order.view';

/**
 * THE STORE-FACING PROJECTION
 * ===========================
 *
 * A separate view from `OrderDetailView` on purpose, and the difference runs
 * both ways.
 *
 * It ADDS what fulfilment needs and the shopper's own view withholds: the
 * customer's name and phone, the full address with landmark and instructions,
 * the coordinates, and who made each status change.
 *
 * It OMITS everything else about the customer. §12: staff see enough to pick,
 * pack, phone and hand over — not an account. There is no email here, no
 * language preference, no order history, no other address, no customer id. That
 * is a deliberate projection, not an oversight: the safest way to avoid leaking
 * a field is for the mapper never to read it.
 */

/** What a manager can do next, named as an operation rather than a raw status. */
export type StoreActionKey =
  | 'CONFIRM'
  | 'REJECT'
  | 'START_PREPARING'
  | 'MARK_PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'READY_FOR_PICKUP'
  | 'COMPLETE_PICKUP'
  | 'MARK_DELIVERED'
  | 'CANCEL'
  | 'MARK_FAILED';

export interface StoreOrderAction {
  /** The target status. This is the only thing the client sends back. */
  status: OrderStatus;
  action: StoreActionKey;
  label: string;
  /**
   * How prominently to render it. Exactly one PRIMARY per order, so §45's "only
   * display the next valid action prominently" is decided here rather than by
   * each screen guessing.
   */
  intent: 'PRIMARY' | 'SECONDARY' | 'DESTRUCTIVE';
  /** Whether the manager must say why. Enforced server-side by the DTO. */
  requiresReason: boolean;
}

/**
 * The action catalogue, keyed by target status.
 *
 * Note what this is NOT: a second state machine. It never decides whether a
 * transition is legal — `allowedNextStatuses` does, from the machine M3 already
 * owns. This only supplies the operator-facing wording and prominence for edges
 * the machine has already permitted. A status with no entry here is simply not
 * offered to staff (`DELIVERED` reached automatically, for instance).
 */
const ACTIONS: Partial<
  Record<
    OrderStatus,
    | Omit<StoreOrderAction, 'status'>
    | ((method: FulfillmentMethod) => Omit<StoreOrderAction, 'status'>)
  >
> = {
  [OrderStatus.CONFIRMED]: {
    action: 'CONFIRM',
    label: 'Confirm order',
    intent: 'PRIMARY',
    requiresReason: false,
  },
  [OrderStatus.PREPARING]: {
    action: 'START_PREPARING',
    label: 'Start preparing',
    intent: 'PRIMARY',
    requiresReason: false,
  },
  [OrderStatus.PACKED]: {
    action: 'MARK_PACKED',
    label: 'Mark packed',
    intent: 'PRIMARY',
    requiresReason: false,
  },
  [OrderStatus.OUT_FOR_DELIVERY]: {
    action: 'OUT_FOR_DELIVERY',
    label: 'Out for delivery',
    intent: 'PRIMARY',
    requiresReason: false,
  },
  [OrderStatus.READY_FOR_PICKUP]: {
    action: 'READY_FOR_PICKUP',
    label: 'Ready for pickup',
    intent: 'PRIMARY',
    requiresReason: false,
  },
  // The same edge reads differently depending on how the order is being
  // fulfilled: a doorstep handover is a delivery, a counter handover is a
  // collection. Staff should see the sentence that matches what they are doing.
  [OrderStatus.DELIVERED]: (method) =>
    method === FulfillmentMethod.PICKUP
      ? {
          action: 'COMPLETE_PICKUP',
          label: 'Complete pickup',
          intent: 'PRIMARY',
          requiresReason: false,
        }
      : {
          action: 'MARK_DELIVERED',
          label: 'Mark delivered',
          intent: 'PRIMARY',
          requiresReason: false,
        },
  [OrderStatus.REJECTED]: {
    action: 'REJECT',
    label: 'Reject order',
    intent: 'DESTRUCTIVE',
    requiresReason: true,
  },
  [OrderStatus.CANCELLED]: {
    action: 'CANCEL',
    label: 'Cancel order',
    intent: 'DESTRUCTIVE',
    requiresReason: true,
  },
  [OrderStatus.FAILED]: {
    action: 'MARK_FAILED',
    label: 'Could not complete',
    intent: 'DESTRUCTIVE',
    requiresReason: true,
  },
};

/**
 * Statuses staff may drive an order to, per status.
 *
 * The machine permits more edges than staff should be *offered*, and the
 * difference is about not presenting the same decision twice:
 *
 * `REJECTED` belongs to PENDING alone. It is the accept-or-not decision.
 *
 * `CANCELLED` belongs to everything after PENDING. Once a store has accepted an
 * order, backing out is a cancellation — it reads differently to the shopper and
 * is recorded differently. Offering both on a pending order would put two
 * buttons on screen for one choice, which §13 and §45 are explicitly about
 * avoiding.
 *
 * `FAILED` is offered only from the two hand-over states, where "it did not work
 * out" has no other honest expression: nobody was home, nobody collected it.
 */
function staffPermits(from: OrderStatus, to: OrderStatus): boolean {
  if (to === OrderStatus.REJECTED) return from === OrderStatus.PENDING;
  if (to === OrderStatus.CANCELLED) return from !== OrderStatus.PENDING;

  if (to === OrderStatus.FAILED) {
    return from === OrderStatus.OUT_FOR_DELIVERY || from === OrderStatus.READY_FOR_PICKUP;
  }

  return true;
}

/**
 * The actions available on an order right now.
 *
 * Derived from the machine, so a pickup order can never be offered "Out for
 * delivery" and a delivery order can never be offered "Ready for pickup" — the
 * edge does not exist, so the button cannot be produced. This is the same
 * guarantee the write path enforces, which is why the UI and the API agree
 * without either restating the rules.
 */
export function actionsFor(order: {
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
}): StoreOrderAction[] {
  if (isTerminal(order.status)) return [];

  return allowedNextStatuses(order.fulfillmentMethod, order.status)
    .filter((next) => staffPermits(order.status, next))
    .map((next) => {
      const entry = ACTIONS[next];
      if (!entry) return null;

      const resolved = typeof entry === 'function' ? entry(order.fulfillmentMethod) : entry;
      return { status: next, ...resolved };
    })
    .filter((action): action is StoreOrderAction => action !== null)
    .sort((a, b) => intentWeight(a.intent) - intentWeight(b.intent));
}

function intentWeight(intent: StoreOrderAction['intent']): number {
  return intent === 'PRIMARY' ? 0 : intent === 'SECONDARY' ? 1 : 2;
}

/**
 * Statuses that are waiting on the store rather than on time passing.
 *
 * PACKED counts: a packed order still needs somebody to send it out or put it on
 * the pickup shelf. OUT_FOR_DELIVERY does not — it is with the rider, and the
 * store's next action only comes when it lands.
 */
const NEEDS_ACTION_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.PACKED,
];

export function needsAction(status: OrderStatus): boolean {
  return NEEDS_ACTION_STATUSES.includes(status);
}

/** The minimum customer identity fulfilment requires. Nothing else. */
export interface StoreCustomerView {
  name: string;
  phone: string;
}

export interface StoreOrderSummaryView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  fulfillmentMethod: FulfillmentMethod;
  itemCount: number;
  totalQuantity: number;
  total: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customer: StoreCustomerView;
  /** True when the store is the party holding this order up. */
  needsAction: boolean;
  /** The one action to surface on a list row, or null. */
  nextAction: StoreOrderAction | null;
  placedAt: Date;
  updatedAt: Date;
}

export interface StoreOrderDetailView extends StoreOrderSummaryView {
  items: Array<{
    productId: string;
    productName: string;
    productImage: string | null;
    brand: string | null;
    sku: string;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  pricing: {
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    currency: string;
  };
  /**
   * The full address, as a picker and a rider need it. Coordinates included:
   * §25 allows staff to hand them to a map application, and they never leave
   * this authenticated projection.
   */
  deliveryAddress: {
    label: string;
    recipientName: string;
    phone: string;
    houseNumber: string;
    street: string;
    area: string;
    city: string;
    landmark: string | null;
    deliveryInstructions: string | null;
    formatted: string;
    latitude: number;
    longitude: number;
  } | null;
  delivery: {
    distanceMeters: number;
    durationSeconds: number | null;
    fee: number;
  } | null;
  pickup: {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    instructions: string | null;
  } | null;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt: Date | null;
  };
  /**
   * The audit trail as staff may see it — including which role acted, which the
   * customer's own view deliberately withholds.
   */
  statusHistory: Array<{
    status: OrderStatus;
    statusLabel: string;
    changedAt: Date;
    changedByRole: string;
    note: string;
  }>;
  customerNote: string | null;
  cancellation: { cancelledAt: Date; reason: string | null; byRole: string | null } | null;
  /** Every action allowed right now, primary first. */
  availableActions: StoreOrderAction[];
}

/**
 * The customer's identity for this order.
 *
 * A delivery order already carries a recipient name and phone in its address
 * snapshot, and that is the right answer — it is who to hand the bag to, which
 * is not always the account holder. A pickup order has no such snapshot, so the
 * account is the only source, and the service supplies it.
 */
function customerFor(order: LeanOrder, account: StoreCustomerView | null): StoreCustomerView {
  if (order.deliveryAddress) {
    return { name: order.deliveryAddress.recipientName, phone: order.deliveryAddress.phone };
  }

  return account ?? { name: 'Customer', phone: '' };
}

export function toStoreOrderSummaryView(
  order: LeanOrder,
  account: StoreCustomerView | null = null,
): StoreOrderSummaryView {
  const actions = actionsFor(order);

  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: statusLabel(order.status, order.fulfillmentMethod),
    fulfillmentMethod: order.fulfillmentMethod,
    itemCount: order.items.length,
    totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    total: order.pricing.total,
    currency: order.pricing.currency,
    paymentMethod: order.payment.method,
    paymentStatus: order.payment.status,
    customer: customerFor(order, account),
    needsAction: needsAction(order.status),
    nextAction: actions.find((action) => action.intent === 'PRIMARY') ?? null,
    placedAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toStoreOrderDetailView(
  order: LeanOrder,
  account: StoreCustomerView | null = null,
): StoreOrderDetailView {
  return {
    ...toStoreOrderSummaryView(order, account),
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      productName: item.productName,
      productImage: item.productImage,
      brand: item.brand,
      sku: item.sku,
      unitLabel: item.unitLabel,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    pricing: {
      subtotal: order.pricing.subtotal,
      deliveryFee: order.pricing.deliveryFee,
      discount: order.pricing.discount,
      total: order.pricing.total,
      currency: order.pricing.currency,
    },
    deliveryAddress: order.deliveryAddress
      ? {
          label: order.deliveryAddress.label,
          recipientName: order.deliveryAddress.recipientName,
          phone: order.deliveryAddress.phone,
          houseNumber: order.deliveryAddress.houseNumber,
          street: order.deliveryAddress.street,
          area: order.deliveryAddress.area,
          city: order.deliveryAddress.city,
          landmark: order.deliveryAddress.landmark,
          deliveryInstructions: order.deliveryAddress.deliveryInstructions,
          formatted: order.deliveryAddress.formatted,
          latitude: order.deliveryAddress.latitude,
          longitude: order.deliveryAddress.longitude,
        }
      : null,
    delivery: order.delivery
      ? {
          distanceMeters: order.delivery.distanceMeters,
          durationSeconds: order.delivery.durationSeconds,
          fee: order.delivery.fee,
        }
      : null,
    pickup: order.pickup
      ? {
          storeName: order.pickup.storeName,
          storeAddress: order.pickup.storeAddress,
          storePhone: order.pickup.storePhone,
          instructions: order.pickup.instructions,
        }
      : null,
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      paidAt: order.payment.paidAt,
    },
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      statusLabel: statusLabel(entry.status, order.fulfillmentMethod),
      changedAt: entry.changedAt,
      changedByRole: entry.changedByRole,
      note: entry.note,
    })),
    customerNote: order.customerNote,
    cancellation: order.cancelledAt
      ? {
          cancelledAt: order.cancelledAt,
          reason: order.cancellationReason,
          byRole: order.cancelledByRole,
        }
      : null,
    availableActions: actionsFor(order),
  };
}
