import { Types } from 'mongoose';
import { UnitType } from 'src/common/enums';
import { LeanAddress } from 'src/modules/addresses';
import { DeliveryQuote } from 'src/modules/delivery';
import { FulfillmentMethod } from 'src/modules/orders/order-status.machine';
import { PaymentMethod } from 'src/modules/payments/enums';

/**
 * Why a line cannot be bought as it stands.
 *
 * Distinct from the cart's own issue codes: the cart describes the *current*
 * catalogue, this describes the difference between what the shopper agreed to
 * and what is true now — which is the thing §46 and §47 require to be shown
 * rather than silently applied.
 */
export type CheckoutIssueCode =
  | 'PRODUCT_UNAVAILABLE'
  | 'PRODUCT_REMOVED'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'PRICE_CHANGED';

export interface CheckoutIssue {
  code: CheckoutIssueCode;
  productId: string;
  productName: string;
  /** Shopper-facing sentence naming the product and what to do about it. */
  message: string;
  /** Present for INSUFFICIENT_STOCK: how many can actually be bought. */
  availableQuantity?: number;
  requestedQuantity?: number;
  /** Present for PRICE_CHANGED. Both whole rupees. */
  previousPrice?: number;
  currentPrice?: number;
}

/**
 * A priced line, built from the catalogue rather than from the request.
 *
 * This is the shape that becomes an order item snapshot verbatim — the same
 * object the shopper reviewed is the one that is persisted, so the preview and
 * the order cannot disagree.
 */
export interface CheckoutLine {
  productId: Types.ObjectId;
  productName: string;
  productImage: string | null;
  brand: string | null;
  sku: string;
  unitLabel: string;
  unitType: UnitType;
  unitValue: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** The store facts a pickup order snapshots and the preview shows. */
export interface PickupDetails {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
}

/**
 * A fully validated, fully priced checkout.
 *
 * Produced by CheckoutService and consumed by OrdersService. Because order
 * creation re-runs the validation that produces this — rather than trusting a
 * draft the client hands back — the preview is genuinely a preview: useful, and
 * never load-bearing.
 */
export interface CheckoutDraft {
  storeId: Types.ObjectId;
  fulfillmentMethod: FulfillmentMethod;
  lines: CheckoutLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: string;
  /** Delivery orders only. */
  address: LeanAddress | null;
  delivery: DeliveryQuote | null;
  /** Pickup orders only. */
  pickup: PickupDetails | null;
  paymentMethod: PaymentMethod | null;
  availablePaymentMethods: Array<{ method: PaymentMethod; label: string }>;
}

/** The preview as it crosses the API boundary — ids as strings, no internals. */
export interface CheckoutPreviewView {
  fulfillmentMethod: FulfillmentMethod;
  items: Array<{
    productId: string;
    productName: string;
    productImage: string | null;
    brand: string | null;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: string;
  delivery: {
    distanceMeters: number;
    durationSeconds: number | null;
    fee: number;
    /** So the UI can explain the limit without hardcoding it. */
    maxDistanceMeters: number;
    address: {
      id: string;
      label: string;
      recipientName: string;
      phone: string;
      formatted: string;
    };
  } | null;
  pickup: PickupDetails | null;
  paymentMethods: Array<{ method: PaymentMethod; label: string }>;
  selectedPaymentMethod: PaymentMethod | null;
}
