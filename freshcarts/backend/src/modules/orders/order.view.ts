import { Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from 'src/modules/payments/enums';
import {
  FulfillmentMethod,
  OrderStatus,
  isCustomerCancellable,
  progressionFor,
} from './order-status.machine';
import { Order, OrderItem } from './schemas';

/** One step of the customer-facing timeline. */
export interface TimelineStep {
  status: OrderStatus;
  label: string;
  /** Already happened. */
  isComplete: boolean;
  /** Happening now — exactly one step is current on a live order. */
  isCurrent: boolean;
  /** When it happened, from the history. Null for steps still ahead. */
  changedAt: Date | null;
  note: string | null;
}

export interface OrderSummaryView {
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
  storeName: string | null;
  /** First few product names, so a list row is recognisable without opening it. */
  previewItems: Array<{ productName: string; productImage: string | null; quantity: number }>;
  canCancel: boolean;
  placedAt: Date;
}

export interface OrderDetailView extends OrderSummaryView {
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
  deliveryAddress: {
    label: string;
    recipientName: string;
    phone: string;
    formatted: string;
    deliveryInstructions: string | null;
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
  timeline: TimelineStep[];
  statusHistory: Array<{ status: OrderStatus; changedAt: Date; note: string }>;
  customerNote: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  updatedAt: Date;
}

/** The lean order shape the mappers accept. */
export type LeanOrder = Order & { _id: Types.ObjectId };

/**
 * Shopper-facing status wording.
 *
 * READY_FOR_PICKUP and OUT_FOR_DELIVERY are the same point in two different
 * journeys, and DELIVERED reads differently depending on which one it ended —
 * "Delivered" to a door, "Collected" over a counter. Same state, honest label.
 */
const STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Order placed',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.PACKED]: 'Packed',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
  [OrderStatus.READY_FOR_PICKUP]: 'Ready for pickup',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.REJECTED]: 'Not accepted',
  [OrderStatus.FAILED]: 'Could not be completed',
};

export function statusLabel(status: OrderStatus, method: FulfillmentMethod): string {
  if (status === OrderStatus.DELIVERED && method === FulfillmentMethod.PICKUP) return 'Collected';
  return STATUS_LABEL[status];
}

/**
 * Builds the timeline from what actually happened.
 *
 * The steps come from the state machine's progression for this fulfilment
 * method, and their completion comes from the recorded history — never from a
 * hardcoded "active step" index. §37: the frontend renders this list; it does
 * not decide which step is current. That keeps one definition of order
 * progress, on the server, where the state machine already lives.
 *
 * A terminated order (cancelled, rejected, failed) shows the progress it made
 * plus the terminal state as the current step, because "cancelled" is genuinely
 * where the order is.
 */
export function buildTimeline(order: LeanOrder): TimelineStep[] {
  const reached = new Map(order.statusHistory.map((entry) => [entry.status, entry] as const));

  const progression = progressionFor(order.fulfillmentMethod);
  const currentIndex = progression.indexOf(order.status);

  const steps: TimelineStep[] = progression.map((status, index) => {
    const entry = reached.get(status);

    return {
      status,
      label: statusLabel(status, order.fulfillmentMethod),
      // Behind the current step, or recorded in history — an order can skip a
      // step operationally, and the timeline should not claim it never happened.
      isComplete: currentIndex >= 0 ? index < currentIndex : Boolean(entry),
      isCurrent: currentIndex === index,
      changedAt: entry?.changedAt ?? null,
      note: entry?.note ?? null,
    };
  });

  // Terminal states are not on the progression, so they are appended as the
  // step the order actually rests on.
  if (currentIndex === -1) {
    const entry = reached.get(order.status);

    steps.push({
      status: order.status,
      label: statusLabel(order.status, order.fulfillmentMethod),
      isComplete: false,
      isCurrent: true,
      changedAt: entry?.changedAt ?? order.updatedAt,
      note: entry?.note ?? null,
    });
  }

  return steps;
}

function itemView(item: OrderItem) {
  return {
    productId: item.productId.toString(),
    productName: item.productName,
    productImage: item.productImage,
    brand: item.brand,
    sku: item.sku,
    unitLabel: item.unitLabel,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

const PREVIEW_ITEM_LIMIT = 3;

export function toOrderSummaryView(
  order: LeanOrder,
  storeName: string | null = null,
): OrderSummaryView {
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
    storeName: order.pickup?.storeName ?? storeName,
    previewItems: order.items.slice(0, PREVIEW_ITEM_LIMIT).map((item) => ({
      productName: item.productName,
      productImage: item.productImage,
      quantity: item.quantity,
    })),
    canCancel: isCustomerCancellable(order.status),
    placedAt: order.createdAt,
  };
}

export function toOrderDetailView(
  order: LeanOrder,
  storeName: string | null = null,
): OrderDetailView {
  return {
    ...toOrderSummaryView(order, storeName),
    items: order.items.map(itemView),
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
          formatted: order.deliveryAddress.formatted,
          deliveryInstructions: order.deliveryAddress.deliveryInstructions,
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
    timeline: buildTimeline(order),
    // The audit trail as the shopper may see it: what happened and when, never
    // who did it. `changedByRole` and `changedByUserId` stay server-side.
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      note: entry.note,
    })),
    customerNote: order.customerNote,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    updatedAt: order.updatedAt,
  };
}
