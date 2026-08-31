import { toQueryString } from '@/features/catalog/catalog.api';
import { apiFetch } from '@/lib/api/client';
import type { Paginated, Product } from '@/types/catalog';
import type {
  RejectionReason,
  StockAdjustment,
  StockChangeReason,
  StoreDashboard,
  StoreInventoryQuery,
  StoreInventoryRow,
  StoreOrderDetail,
  StoreOrderQuery,
  StoreOrderSummary,
  Substitution,
  SubstitutionReason,
} from '@/types/store-manager';
import type { OrderStatus } from '@/types/order';

const ROOT = '/store-manager';

/**
 * Transport for the store-operations API.
 *
 * Nothing here sends a store id — the scope comes from the token, server-side.
 * Nothing here sends a price, a total or an actor either: the API derives all
 * three, and a request carrying one would be rejected outright.
 */
export const storeManagerApi = {
  dashboard: () => apiFetch<StoreDashboard>(ROOT + '/dashboard'),

  orders: (query: StoreOrderQuery) =>
    apiFetch<Paginated<StoreOrderSummary>>(ROOT + '/orders' + toQueryString({ ...query })),

  order: (id: string) => apiFetch<StoreOrderDetail>(ROOT + '/orders/' + id),

  /**
   * Advances an order. The client sends only the target status; whether the
   * order may go there is the state machine's decision.
   */
  updateOrderStatus: (input: { id: string; status: OrderStatus; reason?: string }) =>
    apiFetch<StoreOrderDetail>(ROOT + '/orders/' + input.id + '/status', {
      method: 'PATCH',
      body: { status: input.status, reason: input.reason },
    }),

  rejectOrder: (input: { id: string; reason: RejectionReason; note?: string }) =>
    apiFetch<StoreOrderDetail>(ROOT + '/orders/' + input.id + '/reject', {
      method: 'POST',
      body: { reason: input.reason, note: input.note },
    }),

  proposeSubstitution: (input: {
    orderId: string;
    productId: string;
    replacementProductId: string;
    replacementQuantity?: number;
    reason: SubstitutionReason;
    note?: string;
  }) =>
    apiFetch<Substitution>(
      ROOT + '/orders/' + input.orderId + '/items/' + input.productId + '/substitution',
      {
        method: 'POST',
        body: {
          replacementProductId: input.replacementProductId,
          replacementQuantity: input.replacementQuantity,
          reason: input.reason,
          note: input.note,
        },
      },
    ),

  cancelSubstitution: (id: string) =>
    apiFetch<Substitution>(ROOT + '/substitutions/' + id, { method: 'DELETE' }),

  inventory: (query: StoreInventoryQuery) =>
    apiFetch<Paginated<StoreInventoryRow>>(ROOT + '/inventory' + toQueryString({ ...query })),

  inventoryHistory: (productId: string) =>
    apiFetch<StockAdjustment[]>(ROOT + '/inventory/' + productId + '/history'),

  updateInventory: (input: {
    productId: string;
    quantity?: number;
    adjustBy?: number;
    lowStockThreshold?: number;
    changeReason?: StockChangeReason;
    reason?: string;
  }) => {
    const { productId, ...body } = input;
    return apiFetch<StoreInventoryRow>(ROOT + '/inventory/' + productId, {
      method: 'PATCH',
      body,
    });
  },

  products: (query: { search?: string; page?: number; limit?: number }) =>
    apiFetch<Paginated<Product>>(ROOT + '/products' + toQueryString({ ...query })),

  setProductAvailability: (input: { id: string; availability: 'AVAILABLE' | 'UNAVAILABLE' }) =>
    apiFetch<Product>(ROOT + '/products/' + input.id + '/availability', {
      method: 'PATCH',
      body: { availability: input.availability },
    }),
};
