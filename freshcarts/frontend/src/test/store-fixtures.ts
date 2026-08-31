import type {
  StoreDashboard,
  StoreInventoryRow,
  StoreOrderAction,
  StoreOrderDetail,
  StoreOrderSummary,
  Substitution,
} from '@/types/store-manager';
import type { AuthUser } from '@/types/auth';

export const testStoreManager: AuthUser = {
  id: '64b00000000000000000000a',
  fullName: 'Imran Sheikh',
  phone: '+923001234568',
  role: 'STORE_MANAGER',
  isActive: true,
  preferredLanguage: 'en',
  storeId: '64b000000000000000000001',
  phoneVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const CONFIRM_ACTION: StoreOrderAction = {
  status: 'CONFIRMED',
  action: 'CONFIRM',
  label: 'Confirm order',
  intent: 'PRIMARY',
  requiresReason: false,
};

export const REJECT_ACTION: StoreOrderAction = {
  status: 'REJECTED',
  action: 'REJECT',
  label: 'Reject order',
  intent: 'DESTRUCTIVE',
  requiresReason: true,
};

export const PACK_ACTION: StoreOrderAction = {
  status: 'PACKED',
  action: 'MARK_PACKED',
  label: 'Mark packed',
  intent: 'PRIMARY',
  requiresReason: false,
};

export const CANCEL_ACTION: StoreOrderAction = {
  status: 'CANCELLED',
  action: 'CANCEL',
  label: 'Cancel order',
  intent: 'DESTRUCTIVE',
  requiresReason: true,
};

export function makeStoreOrderSummary(
  overrides: Partial<StoreOrderSummary> = {},
): StoreOrderSummary {
  return {
    id: 'order-1',
    orderNumber: 'FC-2026-0000001',
    status: 'PENDING',
    statusLabel: 'Order placed',
    fulfillmentMethod: 'DELIVERY',
    itemCount: 2,
    totalQuantity: 3,
    total: 1950,
    currency: 'PKR',
    paymentMethod: 'CASH_ON_DELIVERY',
    paymentStatus: 'PENDING',
    customer: { name: 'Ayesha Khan', phone: '+923001234569' },
    needsAction: true,
    nextAction: CONFIRM_ACTION,
    placedAt: '2026-08-31T07:40:00.000Z',
    updatedAt: '2026-08-31T07:40:00.000Z',
    ...overrides,
  };
}

export function makeStoreOrderDetail(
  overrides: Partial<StoreOrderDetail> = {},
): StoreOrderDetail {
  return {
    ...makeStoreOrderSummary(),
    items: [
      {
        productId: 'p1',
        productName: 'Olper’s Full Cream Milk',
        productImage: null,
        brand: 'Olper’s',
        sku: 'FC-DAI-001',
        unitLabel: '1 L',
        quantity: 2,
        unitPrice: 340,
        lineTotal: 680,
      },
      {
        productId: 'p2',
        productName: 'Tapal Danedar Tea',
        productImage: null,
        brand: 'Tapal',
        sku: 'FC-BEV-001',
        unitLabel: '430 g',
        quantity: 1,
        unitPrice: 1150,
        lineTotal: 1150,
      },
    ],
    pricing: { subtotal: 1830, deliveryFee: 120, discount: 0, total: 1950, currency: 'PKR' },
    deliveryAddress: {
      label: 'HOME',
      recipientName: 'Ayesha Khan',
      phone: '+923001234569',
      houseNumber: '42-B',
      street: 'Street 4',
      area: 'Salamatpura',
      city: 'Lahore',
      landmark: 'Opposite Al-Fatah',
      deliveryInstructions: 'Ring the bell twice',
      formatted: '42-B, Street 4, Salamatpura, Lahore',
      latitude: 31.545,
      longitude: 74.372,
    },
    delivery: { distanceMeters: 4300, durationSeconds: 900, fee: 120 },
    pickup: null,
    payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING', paidAt: null },
    statusHistory: [
      {
        status: 'PENDING',
        statusLabel: 'Order placed',
        changedAt: '2026-08-31T07:40:00.000Z',
        changedByRole: 'CUSTOMER',
        note: 'Order placed and waiting for the store to confirm.',
      },
    ],
    customerNote: 'Please call on arrival',
    cancellation: null,
    availableActions: [CONFIRM_ACTION, REJECT_ACTION],
    substitutions: [],
    ...overrides,
  };
}

export function makePickupOrderDetail(
  overrides: Partial<StoreOrderDetail> = {},
): StoreOrderDetail {
  const base = makeStoreOrderDetail();

  return {
    ...base,
    fulfillmentMethod: 'PICKUP',
    deliveryAddress: null,
    delivery: null,
    pickup: {
      storeName: 'FreshCarts Gulberg',
      storeAddress: 'Shop 12, Main Boulevard, Gulberg III, Lahore',
      storePhone: '+923004567890',
      instructions: 'Collect from the front counter',
    },
    pricing: { subtotal: 1830, deliveryFee: 0, discount: 0, total: 1830, currency: 'PKR' },
    total: 1830,
    ...overrides,
  };
}

export function makeStoreDashboard(overrides: Partial<StoreDashboard> = {}): StoreDashboard {
  return {
    store: {
      id: '64b000000000000000000001',
      name: 'FreshCarts Gulberg',
      area: 'Gulberg III',
      city: 'Lahore',
      isActive: true,
      isOpen: true,
    },
    orders: {
      pending: 5,
      confirmed: 3,
      preparing: 4,
      packed: 2,
      readyForPickup: 2,
      outForDelivery: 3,
      completedToday: 18,
      needsAction: 14,
    },
    inventory: { inStock: 51, lowStock: 7, outOfStock: 4 },
    substitutions: { awaitingCustomer: 0 },
    ...overrides,
  };
}

export function makeInventoryRow(
  overrides: Partial<StoreInventoryRow> = {},
): StoreInventoryRow {
  return {
    id: 'inv-1',
    productId: 'p1',
    productName: 'Kashmiri Apples',
    sku: 'FC-FRT-003',
    isProductActive: true,
    quantity: 3,
    lowStockThreshold: 5,
    status: 'LOW_STOCK',
    isAvailable: true,
    updatedAt: '2026-08-31T07:40:00.000Z',
    ...overrides,
  };
}

export function makeSubstitution(overrides: Partial<Substitution> = {}): Substitution {
  return {
    id: 'sub-1',
    orderId: 'order-1',
    status: 'PROPOSED',
    reason: 'OUT_OF_STOCK',
    note: 'Same size, other brand',
    original: {
      productId: 'p1',
      productName: 'Olper’s Full Cream Milk',
      unitLabel: '1 L',
      quantity: 2,
      unitPrice: 340,
      lineTotal: 680,
    },
    replacement: {
      productId: 'p9',
      productName: 'MilkPak Full Cream Milk',
      unitLabel: '1.5 L',
      quantity: 2,
      catalogueUnitPrice: 300,
      catalogueLineTotal: 600,
    },
    chargedLineTotal: 680,
    storeAbsorbs: 0,
    createdByRole: 'STORE_MANAGER',
    createdAt: '2026-08-31T08:00:00.000Z',
    resolvedAt: null,
    resolvedByRole: null,
    ...overrides,
  };
}

/** A paginated envelope, matching the API's shape. */
export function paginate<T>(items: T[], overrides: Partial<{ page: number; totalPages: number }> = {}) {
  return {
    items,
    pagination: {
      page: overrides.page ?? 1,
      limit: 20,
      total: items.length,
      totalPages: overrides.totalPages ?? 1,
    },
  };
}
