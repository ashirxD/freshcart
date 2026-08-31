import type { Address } from '@/types/address';
import type { CheckoutPreview, OrderDetail, OrderSummary } from '@/types/order';

/** The seeded Lahore address, ~4.3 km from the store. */
export function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'addr-1',
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
    hasCoordinates: true,
    isDefault: true,
    formatted: '42-B, Street 4, Salamatpura, Lahore (near Opposite Al-Fatah)',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDeliveryPreview(overrides: Partial<CheckoutPreview> = {}): CheckoutPreview {
  return {
    fulfillmentMethod: 'DELIVERY',
    items: [
      {
        productId: 'p1',
        productName: 'Olper’s Full Cream Milk',
        productImage: null,
        brand: 'Olper’s',
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
        unitLabel: '430 g',
        quantity: 1,
        unitPrice: 1150,
        lineTotal: 1150,
      },
    ],
    itemCount: 2,
    totalQuantity: 3,
    subtotal: 1830,
    deliveryFee: 120,
    discount: 0,
    total: 1950,
    currency: 'PKR',
    delivery: {
      distanceMeters: 4300,
      durationSeconds: 900,
      fee: 120,
      maxDistanceMeters: 12000,
      address: {
        id: 'addr-1',
        label: 'HOME',
        recipientName: 'Ayesha Khan',
        phone: '+923001234569',
        formatted: '42-B, Street 4, Salamatpura, Lahore',
      },
    },
    pickup: null,
    paymentMethods: [{ method: 'CASH_ON_DELIVERY', label: 'Cash on delivery' }],
    selectedPaymentMethod: 'CASH_ON_DELIVERY',
    ...overrides,
  };
}

export function makePickupPreview(overrides: Partial<CheckoutPreview> = {}): CheckoutPreview {
  const base = makeDeliveryPreview();

  return {
    ...base,
    fulfillmentMethod: 'PICKUP',
    deliveryFee: 0,
    total: base.subtotal,
    delivery: null,
    pickup: {
      storeName: 'FreshCarts Gulberg',
      storeAddress: 'Shop 12, Main Boulevard, Gulberg III, Lahore',
      storePhone: '+923004567890',
      latitude: 31.5102,
      longitude: 74.3441,
      instructions: 'Please bring your order number. Orders are held for 24 hours.',
    },
    ...overrides,
  };
}

export function makeOrderSummary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'order-1',
    orderNumber: 'FC-2026-0001482',
    status: 'PENDING',
    statusLabel: 'Order placed',
    fulfillmentMethod: 'DELIVERY',
    itemCount: 2,
    totalQuantity: 3,
    total: 1950,
    currency: 'PKR',
    paymentMethod: 'CASH_ON_DELIVERY',
    paymentStatus: 'PENDING',
    storeName: 'FreshCarts Gulberg',
    previewItems: [
      { productName: 'Olper’s Full Cream Milk', productImage: null, quantity: 2 },
      { productName: 'Tapal Danedar Tea', productImage: null, quantity: 1 },
    ],
    canCancel: true,
    placedAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeOrderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    ...makeOrderSummary(),
    items: [
      {
        productId: 'p1',
        productName: 'Olper’s Full Cream Milk',
        productImage: null,
        brand: 'Olper’s',
        sku: 'MILK-1L',
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
        sku: 'TEA-430',
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
      formatted: '42-B, Street 4, Salamatpura, Lahore',
      deliveryInstructions: 'Ring the bell twice',
    },
    delivery: { distanceMeters: 4300, durationSeconds: 900, fee: 120 },
    pickup: null,
    payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING', paidAt: null },
    timeline: [
      {
        status: 'PENDING',
        label: 'Order placed',
        isComplete: false,
        isCurrent: true,
        changedAt: '2026-02-01T10:00:00.000Z',
        note: 'Order placed and waiting for the store to confirm.',
      },
      {
        status: 'CONFIRMED',
        label: 'Confirmed',
        isComplete: false,
        isCurrent: false,
        changedAt: null,
        note: null,
      },
      {
        status: 'PREPARING',
        label: 'Preparing',
        isComplete: false,
        isCurrent: false,
        changedAt: null,
        note: null,
      },
      {
        status: 'PACKED',
        label: 'Packed',
        isComplete: false,
        isCurrent: false,
        changedAt: null,
        note: null,
      },
      {
        status: 'OUT_FOR_DELIVERY',
        label: 'Out for delivery',
        isComplete: false,
        isCurrent: false,
        changedAt: null,
        note: null,
      },
      {
        status: 'DELIVERED',
        label: 'Delivered',
        isComplete: false,
        isCurrent: false,
        changedAt: null,
        note: null,
      },
    ],
    statusHistory: [
      {
        status: 'PENDING',
        changedAt: '2026-02-01T10:00:00.000Z',
        note: 'Order placed and waiting for the store to confirm.',
      },
    ],
    customerNote: null,
    cancelledAt: null,
    cancellationReason: null,
    updatedAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

// --- Grocery-list scanner --------------------------------------------------

/** A candidate product as the scan API returns it. */
export function makeScanCandidate(
  overrides: Partial<import('@/types/scan').ScanCandidate> = {},
): import('@/types/scan').ScanCandidate {
  return {
    productId: 'p-milk-olpers',
    name: 'Olper’s Full Cream Milk',
    brand: 'Olper’s',
    image: null,
    unitLabel: '1 L',
    price: 340,
    confidence: 'HIGH',
    availableQuantity: 20,
    isAvailable: true,
    unitMatches: true,
    ...overrides,
  };
}

/** A confidently matched line: "2 doodh" -> Olper's Milk ×2. */
export function makeMatchedItem(
  overrides: Partial<import('@/types/scan').ScanItem> = {},
): import('@/types/scan').ScanItem {
  return {
    lineId: 'line-1',
    source: {
      rawText: '2 doodh',
      normalizedName: 'milk',
      quantity: 2,
      unit: null,
      unitValue: null,
      brand: null,
      confidence: 0.93,
      script: 'latin',
      quantityAdjusted: false,
    },
    match: { status: 'MATCHED', confidence: 'HIGH', product: makeScanCandidate() },
    alternatives: [],
    ...overrides,
  };
}

/** An ambiguous line: "surf" against two detergents, nothing pre-selected. */
export function makeAmbiguousItem(
  overrides: Partial<import('@/types/scan').ScanItem> = {},
): import('@/types/scan').ScanItem {
  return {
    lineId: 'line-2',
    source: {
      rawText: 'surf 1',
      normalizedName: 'detergent',
      quantity: 1,
      unit: null,
      unitValue: null,
      brand: null,
      confidence: 0.88,
      script: 'latin',
      quantityAdjusted: false,
    },
    match: { status: 'AMBIGUOUS', confidence: 'MEDIUM', product: null },
    alternatives: [
      makeScanCandidate({
        productId: 'p-surf-1kg',
        name: 'Surf Excel Washing Powder',
        brand: 'Surf Excel',
        unitLabel: '1 kg',
        price: 690,
        confidence: 'MEDIUM',
      }),
      makeScanCandidate({
        productId: 'p-ariel-500g',
        name: 'Ariel Detergent Powder',
        brand: 'Ariel',
        unitLabel: '500 g',
        price: 390,
        confidence: 'MEDIUM',
      }),
    ],
    ...overrides,
  };
}

/** A line nothing in the catalogue answers to. */
export function makeNotFoundItem(
  overrides: Partial<import('@/types/scan').ScanItem> = {},
): import('@/types/scan').ScanItem {
  return {
    lineId: 'line-3',
    source: {
      rawText: 'zafraan',
      normalizedName: 'zafraan',
      quantity: 1,
      unit: null,
      unitValue: null,
      brand: null,
      confidence: 0.71,
      script: 'latin',
      quantityAdjusted: false,
    },
    match: { status: 'NOT_FOUND', confidence: null, product: null },
    alternatives: [],
    ...overrides,
  };
}

export function makeScanResult(
  overrides: Partial<import('@/types/scan').ScanResult> = {},
): import('@/types/scan').ScanResult {
  const items = overrides.items ?? [makeMatchedItem(), makeAmbiguousItem(), makeNotFoundItem()];

  return {
    scanId: 'scan-1',
    language: 'en',
    items,
    summary: {
      detected: items.length,
      matched: items.filter((item) => item.match.status === 'MATCHED').length,
      ambiguous: items.filter((item) => item.match.status === 'AMBIGUOUS').length,
      notFound: items.filter((item) => item.match.status === 'NOT_FOUND').length,
      unavailable: 0,
      estimatedTotal: 680,
    },
    warnings: [],
    ...overrides,
  };
}
