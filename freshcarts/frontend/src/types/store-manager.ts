import type { StockStatus } from './catalog';
import type { FulfillmentMethod, OrderStatus, PaymentMethod, PaymentStatus } from './order';

/**
 * Mirrors of the store-operations API shapes.
 *
 * Read-only contracts, and two things are worth naming explicitly:
 *
 * There is no `storeId` anywhere in this file. The scope is resolved server-side
 * from the authenticated principal, so the client neither sends nor needs one.
 *
 * `availableActions` is decided by the server's state machine. The console
 * renders exactly what it is given — it never works out for itself which
 * transition is next, which is what keeps a button from existing that the API
 * would refuse.
 */

export interface StoreDashboard {
  store: {
    id: string;
    name: string;
    area: string;
    city: string;
    isActive: boolean;
    isOpen: boolean;
  };
  orders: {
    pending: number;
    confirmed: number;
    preparing: number;
    packed: number;
    readyForPickup: number;
    outForDelivery: number;
    completedToday: number;
    needsAction: number;
  };
  inventory: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  substitutions: { awaitingCustomer: number };
}

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
  /** The target status — the only thing the client sends back. */
  status: OrderStatus;
  action: StoreActionKey;
  label: string;
  intent: 'PRIMARY' | 'SECONDARY' | 'DESTRUCTIVE';
  requiresReason: boolean;
}

/** Only what fulfilment needs. The API does not send more (§12). */
export interface StoreOrderCustomer {
  name: string;
  phone: string;
}

export interface StoreOrderSummary {
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
  customer: StoreOrderCustomer;
  /** True when the store is the party holding this order up. */
  needsAction: boolean;
  nextAction: StoreOrderAction | null;
  placedAt: string;
  updatedAt: string;
}

export interface StoreOrderItem {
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

export interface StoreOrderDetail extends StoreOrderSummary {
  items: StoreOrderItem[];
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
  delivery: { distanceMeters: number; durationSeconds: number | null; fee: number } | null;
  pickup: {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    instructions: string | null;
  } | null;
  payment: { method: PaymentMethod; status: PaymentStatus; paidAt: string | null };
  /** Includes the acting role, which the customer's own view withholds. */
  statusHistory: Array<{
    status: OrderStatus;
    statusLabel: string;
    changedAt: string;
    changedByRole: string;
    note: string;
  }>;
  customerNote: string | null;
  cancellation: { cancelledAt: string; reason: string | null; byRole: string | null } | null;
  availableActions: StoreOrderAction[];
  substitutions: Substitution[];
}

// --- Substitutions -------------------------------------------------------

export type SubstitutionStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type SubstitutionReason = 'OUT_OF_STOCK' | 'DAMAGED' | 'EXPIRED' | 'QUALITY' | 'OTHER';

export interface Substitution {
  id: string;
  orderId: string;
  status: SubstitutionStatus;
  reason: SubstitutionReason;
  note: string | null;
  original: {
    productId: string;
    productName: string;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  };
  replacement: {
    productId: string;
    productName: string;
    unitLabel: string;
    quantity: number;
    catalogueUnitPrice: number;
    catalogueLineTotal: number;
  };
  /** What the shopper is charged if they accept — always the original total. */
  chargedLineTotal: number;
  /** Rupees the store absorbs. Never negative. */
  storeAbsorbs: number;
  createdByRole: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByRole: string | null;
}

// --- Inventory -----------------------------------------------------------

export type StockChangeReason =
  | 'RESTOCK'
  | 'CORRECTION'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'ORDER'
  | 'OTHER';

export interface StoreInventoryRow {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  isProductActive: boolean;
  quantity: number;
  lowStockThreshold: number;
  status: StockStatus;
  isAvailable: boolean;
  updatedAt: string;
}

export interface StockAdjustment {
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  reason: StockChangeReason;
  note: string | null;
  changedByRole: string;
  changedAt: string;
}

// --- Query inputs --------------------------------------------------------

export interface StoreOrderQuery {
  status?: OrderStatus;
  fulfillmentMethod?: FulfillmentMethod;
  needsAction?: boolean;
  orderNumber?: string;
  placedFrom?: string;
  placedTo?: string;
  page?: number;
  limit?: number;
}

export interface StoreInventoryQuery {
  search?: string;
  status?: StockStatus;
  page?: number;
  limit?: number;
}

export const REJECTION_REASONS = [
  { value: 'UNABLE_TO_FULFILL', label: 'Store unable to fulfil' },
  { value: 'ITEMS_UNAVAILABLE', label: 'Items unavailable' },
  { value: 'STORE_CLOSED', label: 'Store closed' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number]['value'];

export const SUBSTITUTION_REASONS = [
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'EXPIRED', label: 'Expired or near expiry' },
  { value: 'QUALITY', label: 'Quality not acceptable' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const STOCK_CHANGE_REASONS = [
  { value: 'RESTOCK', label: 'Restock' },
  { value: 'CORRECTION', label: 'Correction' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'OTHER', label: 'Other' },
] as const;
