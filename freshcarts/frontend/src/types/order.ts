/**
 * Mirrors of the order and checkout API shapes.
 *
 * Read-only contracts. Every monetary value here is a whole rupee computed by
 * the server, every status is decided by the server's state machine, and every
 * timeline step arrives already marked complete/current. The browser renders
 * these; it never re-derives them.
 */

export type FulfillmentMethod = 'DELIVERY' | 'PICKUP';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'FAILED';

export type PaymentMethod = 'CASH_ON_DELIVERY' | 'CARD' | 'MOBILE_WALLET';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface PaymentMethodOption {
  method: PaymentMethod;
  label: string;
}

// --- Checkout preview ----------------------------------------------------

export interface CheckoutPreviewItem {
  productId: string;
  productName: string;
  productImage: string | null;
  brand: string | null;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PickupDetails {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
}

export interface CheckoutDelivery {
  distanceMeters: number;
  durationSeconds: number | null;
  fee: number;
  /** The service radius, so the UI explains the limit without hardcoding it. */
  maxDistanceMeters: number;
  address: {
    id: string;
    label: string;
    recipientName: string;
    phone: string;
    formatted: string;
  };
}

export interface CheckoutPreview {
  fulfillmentMethod: FulfillmentMethod;
  items: CheckoutPreviewItem[];
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: string;
  delivery: CheckoutDelivery | null;
  pickup: PickupDetails | null;
  paymentMethods: PaymentMethodOption[];
  selectedPaymentMethod: PaymentMethod | null;
}

export interface CheckoutPreviewInput {
  fulfillmentMethod: FulfillmentMethod;
  addressId?: string;
  paymentMethod?: PaymentMethod;
}

// --- Checkout problems ---------------------------------------------------

export type CheckoutIssueCode =
  | 'PRODUCT_UNAVAILABLE'
  | 'PRODUCT_REMOVED'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'PRICE_CHANGED';

/** A blocker the shopper can act on, as the API reports it. */
export interface CheckoutIssue {
  code: CheckoutIssueCode;
  productId: string;
  productName: string;
  message: string;
  availableQuantity?: number;
  requestedQuantity?: number;
  previousPrice?: number;
  currentPrice?: number;
}

/** The `details` payload attached to a CHECKOUT_VALIDATION_FAILED response. */
export interface CheckoutIssueDetails {
  issues: CheckoutIssue[];
  /** True when every problem is a price move, which the shopper can simply accept. */
  requiresPriceAcceptance: boolean;
}

/** The `details` payload attached to a DELIVERY_UNAVAILABLE response. */
export interface DeliveryUnavailableDetails {
  distanceMeters: number;
  maxDistanceMeters: number;
}

// --- Orders --------------------------------------------------------------

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string | null;
  brand: string | null;
  sku: string;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface TimelineStep {
  status: OrderStatus;
  label: string;
  isComplete: boolean;
  /** Exactly one step is current. Decided by the server, never by the client. */
  isCurrent: boolean;
  changedAt: string | null;
  note: string | null;
}

export interface OrderSummary {
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
  previewItems: Array<{ productName: string; productImage: string | null; quantity: number }>;
  /** Server's answer to "may this shopper cancel right now?". */
  canCancel: boolean;
  placedAt: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
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
    paidAt: string | null;
  };
  timeline: TimelineStep[];
  statusHistory: Array<{ status: OrderStatus; changedAt: string; note: string }>;
  customerNote: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
}

/**
 * What POST /orders accepts.
 *
 * Note the absence of prices, totals and status: the server reads or computes
 * all of them, and sending one is rejected outright by the API.
 */
export interface CreateOrderInput {
  fulfillmentMethod: FulfillmentMethod;
  addressId?: string;
  paymentMethod: PaymentMethod;
  customerNote?: string;
}
