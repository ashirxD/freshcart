import { Role } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';

/**
 * How a shopper receives the order. Chosen once, at checkout, and never changed
 * afterwards — the two fulfilment paths have different lifecycles, different
 * pricing and different snapshots, so switching mid-order is a new order.
 */
export enum FulfillmentMethod {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

/**
 * Order lifecycle states.
 *
 * `DELIVERED` is the shared completion state for both paths: a collected pickup
 * order is delivered to its customer, just over a counter rather than a
 * doorstep. Using one terminal state keeps "is this order finished?" a single
 * comparison everywhere — reporting, payment settlement, the UI — instead of a
 * two-branch rule that will eventually be written wrong somewhere.
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  PACKED = 'PACKED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

/** Nothing follows these. Reaching one ends the order's life. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
  OrderStatus.FAILED,
];

/**
 * States a customer may cancel from.
 *
 * The line is drawn where the store starts spending: once picking has begun,
 * perishables have been pulled off shelves and a unilateral customer
 * cancellation would push that cost onto the store. From PREPARING onward the
 * shopper can still ask, but a staff member has to agree — which is a
 * store-side action, and therefore a later milestone.
 */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

/**
 * THE STATE MACHINE
 *
 * Transitions are declared per fulfilment method, which is what mechanically
 * enforces §8's hard rule: a PICKUP order has no edge to OUT_FOR_DELIVERY and a
 * DELIVERY order has no edge to READY_FOR_PICKUP. It is not a check that could
 * be forgotten — the edge does not exist.
 *
 * The frontend cannot bypass this. There is no endpoint that accepts a status
 * from a customer at all; the only customer-initiated transition is
 * cancellation, which routes through `assertCustomerCanCancel`.
 */
const DELIVERY_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED, OrderStatus.REJECTED],
  [OrderStatus.PREPARING]: [OrderStatus.PACKED, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.PACKED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  // Not reachable on this path — declared so the record is total and a lookup
  // never returns undefined.
  [OrderStatus.READY_FOR_PICKUP]: [],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.FAILED]: [],
};

const PICKUP_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED, OrderStatus.REJECTED],
  [OrderStatus.PREPARING]: [OrderStatus.PACKED, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.PACKED]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.OUT_FOR_DELIVERY]: [],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.FAILED]: [],
};

function transitionsFor(method: FulfillmentMethod) {
  return method === FulfillmentMethod.DELIVERY ? DELIVERY_TRANSITIONS : PICKUP_TRANSITIONS;
}

/** The happy path, in order. Powers the customer timeline. */
export function progressionFor(method: FulfillmentMethod): OrderStatus[] {
  return method === FulfillmentMethod.DELIVERY
    ? [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.PACKED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
      ]
    : [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.PACKED,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.DELIVERED,
      ];
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(
  method: FulfillmentMethod,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return transitionsFor(method)[from].includes(to);
}

export function allowedNextStatuses(
  method: FulfillmentMethod,
  from: OrderStatus,
): readonly OrderStatus[] {
  return transitionsFor(method)[from];
}

/**
 * The gate every status write goes through.
 *
 * Throwing rather than returning a boolean is deliberate: a caller cannot
 * accidentally ignore the result, which is exactly the failure mode that lets
 * an invalid transition reach the database.
 */
export function assertTransition(
  method: FulfillmentMethod,
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!canTransition(method, from, to)) {
    throw BusinessException.invalidStatusTransition(from, to);
  }
}

/**
 * Whether *this actor* may cancel, which is a different question from whether
 * the transition exists.
 *
 * A store manager may cancel a PREPARING order; a customer may not. Both are
 * legal edges in the machine — authority is the separate axis, and conflating
 * the two is how "customers can cancel anything the machine allows" bugs happen.
 */
export function assertCustomerCanCancel(status: OrderStatus): void {
  if (isTerminal(status)) {
    throw BusinessException.orderNotCancellable(
      status === OrderStatus.DELIVERED
        ? 'This order has already been completed and cannot be cancelled.'
        : 'This order is already closed.',
    );
  }

  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(status)) {
    throw BusinessException.orderNotCancellable(
      'We have already started preparing this order, so it can no longer be cancelled online. Please call the store.',
    );
  }
}

/** True when the shopper's own Cancel button should be shown at all. */
export function isCustomerCancellable(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE_STATUSES.includes(status);
}

/**
 * Who a status change is attributed to in the history.
 *
 * `SYSTEM` covers changes nobody clicked — order creation, an automated
 * failure — so the history never has to lie about a human having acted.
 */
export type StatusActor = Role | 'SYSTEM';

/** Default note recorded when a caller does not supply one. Shopper-facing wording. */
export const STATUS_NOTES: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Order placed and waiting for the store to confirm.',
  [OrderStatus.CONFIRMED]: 'The store has confirmed your order.',
  [OrderStatus.PREPARING]: 'Your order is being prepared.',
  [OrderStatus.PACKED]: 'Your order has been packed.',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Your order is on its way.',
  [OrderStatus.READY_FOR_PICKUP]: 'Your order is ready to collect from the store.',
  [OrderStatus.DELIVERED]: 'Order completed.',
  [OrderStatus.CANCELLED]: 'Order cancelled.',
  [OrderStatus.REJECTED]: 'The store could not accept this order.',
  [OrderStatus.FAILED]: 'This order could not be completed.',
};
