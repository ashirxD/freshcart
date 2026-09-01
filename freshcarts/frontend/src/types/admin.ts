import type { OrderStatus } from './order';
import type { StoreOrderDetail, StoreOrderSummary } from './store-manager';

/**
 * Mirrors of the admin API shapes.
 *
 * Read-only contracts. Two things worth naming:
 *
 * The order types EXTEND the store-operations ones rather than restating them.
 * An admin sees exactly what a store sees, plus which store — so a change to
 * the fulfilment projection reaches both surfaces at once, and there is no
 * second definition of "an order" to keep in step.
 *
 * `availableActions` still comes from the server's state machine, unchanged. An
 * admin override is a mandatory-reason wrapper around the same transitions, not
 * an escape from them, so this client never works out a next status for itself.
 */

// --- Dashboard -----------------------------------------------------------

export interface AdminOrderMetrics {
  ordersToday: number;
  revenueToday: number;
  ordersThisWeek: number;
  revenueThisWeek: number;
  pending: number;
  needsAction: number;
  outForDelivery: number;
  readyForPickup: number;
  byStatus: Record<OrderStatus, number>;
}

export interface AdminDashboard {
  orders: AdminOrderMetrics;
  catalogue: {
    activeProducts: number;
    inactiveProducts: number;
    categories: number;
  };
  inventory: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  people: {
    customers: number;
    activeCustomers: number;
    storeManagers: number;
  };
  stores: {
    total: number;
    active: number;
    open: number;
  };
  platform: {
    orderingEnabled: boolean;
    maxDeliveryDistanceMeters: number;
  };
}

// --- Orders --------------------------------------------------------------

export interface AdminOrderStoreRef {
  id: string;
  name: string;
}

export interface AdminOrderSummary extends StoreOrderSummary {
  store: AdminOrderStoreRef;
}

export interface AdminOrderDetail extends Omit<StoreOrderDetail, 'substitutions'> {
  store: AdminOrderStoreRef;
}

export interface AdminOrderQuery {
  page?: number;
  status?: OrderStatus;
  fulfillmentMethod?: 'DELIVERY' | 'PICKUP';
  storeId?: string;
  orderNumber?: string;
  customer?: string;
  needsAction?: boolean;
}

// --- People --------------------------------------------------------------

export interface AdminCustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminStoreManager {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  store: { id: string; name: string } | null;
}

export interface CreateStoreManagerInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  storeId: string;
}

export interface UpdateStoreManagerInput {
  fullName?: string;
  email?: string;
  storeId?: string;
  isActive?: boolean;
}

// --- Stores --------------------------------------------------------------

export interface StoreOpeningHours {
  day: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface AdminStore {
  id: string;
  name: string;
  slug: string;
  description?: string;
  phone: string;
  email?: string;
  isActive: boolean;
  address: {
    line1: string;
    line2?: string;
    area: string;
    city: string;
    province?: string;
    postalCode?: string;
    country: string;
  };
  location: { type: 'Point'; coordinates: [number, number] };
  openingHours: StoreOpeningHours[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreInput {
  name: string;
  description?: string;
  phone: string;
  email?: string;
  address: {
    line1: string;
    line2?: string;
    area: string;
    city: string;
    province?: string;
    postalCode?: string;
  };
  location: { latitude: number; longitude: number };
  openingHours?: StoreOpeningHours[];
  isActive?: boolean;
}

// --- Delivery pricing ----------------------------------------------------

export interface DeliveryRule {
  id: string;
  label: string;
  /** Inclusive lower bound, metres. */
  minDistanceMeters: number;
  /** Exclusive upper bound, metres — bands are half-open. */
  maxDistanceMeters: number;
  fee: number;
  priority: number;
  isActive: boolean;
}

/** What is wrong with the rule set as a whole, reported by the server. */
export interface RuleSetProblem {
  kind: 'OVERLAP' | 'GAP' | 'EMPTY';
  message: string;
}

export interface DeliveryRuleSet {
  rules: DeliveryRule[];
  problems: RuleSetProblem[];
}

export interface DeliveryRuleInput {
  label: string;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  fee: number;
  priority?: number;
  isActive?: boolean;
}

// --- Settings ------------------------------------------------------------

export interface PlatformSettings {
  maxDeliveryDistanceMeters: number;
  defaultLowStockThreshold: number;
  orderingEnabled: boolean;
  supportPhone: string;
  supportEmail: string;
  updatedAt: string | null;
  /** Deployment facts, shown read-only. Changing these needs a redeploy. */
  environment: {
    paymentMethods: string[];
    routingProvider: string;
    aiServiceEnabled: boolean;
  };
}

export type PlatformSettingsInput = Partial<
  Pick<
    PlatformSettings,
    | 'maxDeliveryDistanceMeters'
    | 'defaultLowStockThreshold'
    | 'orderingEnabled'
    | 'supportPhone'
    | 'supportEmail'
  >
>;

/** The public subset, readable without an account. */
export interface PublicSettings {
  supportPhone: string;
  supportEmail: string;
  maxDeliveryDistanceMeters: number;
  orderingEnabled: boolean;
}

// --- Audit ---------------------------------------------------------------

export type AuditAction =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_STATUS_CHANGED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_STATUS_CHANGED'
  | 'INVENTORY_ADJUSTED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_STATUS_OVERRIDDEN'
  | 'USER_STATUS_CHANGED'
  | 'USER_ROLE_CHANGED'
  | 'STORE_MANAGER_CREATED'
  | 'STORE_MANAGER_UPDATED'
  | 'STORE_CREATED'
  | 'STORE_UPDATED'
  | 'DELIVERY_RULE_CREATED'
  | 'DELIVERY_RULE_UPDATED'
  | 'DELIVERY_RULE_DELETED'
  | 'SETTINGS_UPDATED';

export type AuditEntity =
  'PRODUCT' | 'CATEGORY' | 'INVENTORY' | 'ORDER' | 'USER' | 'STORE' | 'DELIVERY_RULE' | 'SETTINGS';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string | null;
  actorRole: 'CUSTOMER' | 'STORE_MANAGER' | 'ADMIN';
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  /** Scalars only — the server strips anything else before storing it. */
  metadata: Record<string, string | number | boolean>;
  occurredAt: string;
}
