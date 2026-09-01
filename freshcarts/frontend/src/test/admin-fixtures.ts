import type { AuthUser } from '@/types/auth';
import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderSummary,
  AdminStore,
  AdminStoreManager,
  AuditLogEntry,
  DeliveryRule,
  DeliveryRuleSet,
  PlatformSettings,
} from '@/types/admin';
import { makeStoreOrderDetail, makeStoreOrderSummary } from './store-fixtures';

export const testAdmin: AuthUser = {
  id: '64b000000000000000000001',
  fullName: 'Sana Malik',
  phone: '+923001234567',
  role: 'ADMIN',
  isActive: true,
  preferredLanguage: 'en',
  phoneVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const STORE_REF = { id: '64b000000000000000000001', name: 'FreshCarts Gulberg' };

export function makeAdminDashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    orders: {
      ordersToday: 4,
      revenueToday: 5_600,
      ordersThisWeek: 27,
      revenueThisWeek: 41_300,
      pending: 2,
      needsAction: 3,
      outForDelivery: 1,
      readyForPickup: 0,
      byStatus: {
        PENDING: 2,
        CONFIRMED: 1,
        PREPARING: 0,
        PACKED: 0,
        READY_FOR_PICKUP: 0,
        OUT_FOR_DELIVERY: 1,
        DELIVERED: 22,
        CANCELLED: 1,
        REJECTED: 0,
        FAILED: 0,
      },
    },
    catalogue: { activeProducts: 52, inactiveProducts: 1, categories: 31 },
    inventory: { inStock: 48, lowStock: 3, outOfStock: 2 },
    people: { customers: 40, activeCustomers: 38, storeManagers: 2 },
    stores: { total: 2, active: 2, open: 1 },
    platform: { orderingEnabled: true, maxDeliveryDistanceMeters: 12_000 },
    ...overrides,
  };
}

/** An admin order row is a store row plus the store it belongs to. */
export function makeAdminOrderSummary(
  overrides: Partial<AdminOrderSummary> = {},
): AdminOrderSummary {
  return { ...makeStoreOrderSummary(), store: STORE_REF, ...overrides };
}

export function makeAdminOrderDetail(overrides: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
  const { substitutions: _substitutions, ...detail } = makeStoreOrderDetail();
  return { ...detail, store: STORE_REF, ...overrides };
}

export function makeCustomer(overrides: Partial<AdminCustomerSummary> = {}): AdminCustomerSummary {
  return {
    id: '64b000000000000000000010',
    fullName: 'Ayesha Khan',
    phone: '+923001234599',
    email: 'ayesha@example.com',
    isActive: true,
    createdAt: '2026-01-15T00:00:00.000Z',
    lastLoginAt: '2026-08-30T09:00:00.000Z',
    ...overrides,
  };
}

export function makeCustomerDetail(
  overrides: Partial<AdminCustomerDetail> = {},
): AdminCustomerDetail {
  return {
    ...makeCustomer(),
    orderCount: 7,
    totalSpent: 18_400,
    lastOrderAt: '2026-08-28T12:00:00.000Z',
    ...overrides,
  };
}

export function makeStoreManagerAccount(
  overrides: Partial<AdminStoreManager> = {},
): AdminStoreManager {
  return {
    id: '64b00000000000000000000a',
    fullName: 'Imran Sheikh',
    phone: '+923001234568',
    email: 'imran@example.com',
    isActive: true,
    createdAt: '2026-01-10T00:00:00.000Z',
    lastLoginAt: '2026-08-31T08:00:00.000Z',
    store: STORE_REF,
    ...overrides,
  };
}

export function makeAdminStore(overrides: Partial<AdminStore> = {}): AdminStore {
  return {
    id: STORE_REF.id,
    name: STORE_REF.name,
    slug: 'freshcarts-gulberg',
    phone: '+923001112233',
    isActive: true,
    address: { line1: '12 Main Boulevard', area: 'Gulberg III', city: 'Lahore', country: 'PK' },
    // GeoJSON order: [longitude, latitude].
    location: { type: 'Point', coordinates: [74.3441, 31.5102] },
    openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      opensAt: '08:00',
      closesAt: '23:00',
      isClosed: false,
    })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDeliveryRule(overrides: Partial<DeliveryRule> = {}): DeliveryRule {
  return {
    id: '64b0000000000000000000aa',
    label: 'Nearby',
    minDistanceMeters: 0,
    maxDistanceMeters: 2_000,
    fee: 80,
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

export function makeRuleSet(overrides: Partial<DeliveryRuleSet> = {}): DeliveryRuleSet {
  return {
    rules: [
      makeDeliveryRule(),
      makeDeliveryRule({
        id: '64b0000000000000000000bb',
        label: 'Across town',
        minDistanceMeters: 2_000,
        maxDistanceMeters: 12_000,
        fee: 150,
      }),
    ],
    problems: [],
    ...overrides,
  };
}

export function makePlatformSettings(overrides: Partial<PlatformSettings> = {}): PlatformSettings {
  return {
    maxDeliveryDistanceMeters: 12_000,
    defaultLowStockThreshold: 5,
    orderingEnabled: true,
    supportPhone: '+923001234500',
    supportEmail: 'support@freshcarts.pk',
    updatedAt: '2026-08-30T00:00:00.000Z',
    environment: {
      paymentMethods: ['CASH_ON_DELIVERY'],
      routingProvider: 'osrm',
      aiServiceEnabled: true,
    },
    ...overrides,
  };
}

export function makeAuditEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: '64b0000000000000000000cc',
    actorId: testAdmin.id,
    actorName: 'Sana Malik',
    actorRole: 'ADMIN',
    action: 'PRODUCT_STATUS_CHANGED',
    entityType: 'PRODUCT',
    entityId: '64b000000000000000000030',
    metadata: { sku: 'MLK-001', isActive: false },
    occurredAt: '2026-08-31T10:00:00.000Z',
    ...overrides,
  };
}
