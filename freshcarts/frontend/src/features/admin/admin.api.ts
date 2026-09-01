import { toQueryString } from '@/features/catalog/catalog.api';
import { apiFetch } from '@/lib/api/client';
import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderQuery,
  AdminOrderSummary,
  AdminStore,
  AdminStoreManager,
  AuditLogEntry,
  CreateStoreManagerInput,
  DeliveryRule,
  DeliveryRuleInput,
  DeliveryRuleSet,
  PlatformSettings,
  PlatformSettingsInput,
  StoreInput,
  UpdateStoreManagerInput,
} from '@/types/admin';
import type {
  Category,
  CategoryDetail,
  InventoryRow,
  Paginated,
  Product,
  ProductDetail,
  ProductQuery,
  StockUpdateResult,
} from '@/types/catalog';
import type { OrderStatus } from '@/types/order';

/** What a category form submits. The server derives the slug regardless. */
export interface CategoryInput {
  name: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

/** What a product form submits. Prices are whole rupees, as integers. */
export interface ProductInput {
  name: string;
  description?: string;
  shortDescription?: string;
  brand?: string;
  categoryId: string;
  subcategoryId?: string | null;
  images?: Array<{ url: string; alt: string; sortOrder?: number }>;
  sellingPrice: number;
  compareAtPrice?: number | null;
  unitType: string;
  unitValue: number;
  sku: string;
  barcode?: string;
  searchTerms?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  initialQuantity?: number;
  lowStockThreshold?: number;
}

/** What the upload endpoint hands back. `url` is a rooted path, not an origin. */
export interface StoredImage {
  url: string;
  key: string;
  contentType: string;
  bytes: number;
}

/**
 * Back-office transport. These hit the same endpoints the storefront reads
 * from — the only difference is the ADMIN token, which is what unlocks the
 * writes and the `includeInactive` view.
 */
export const adminApi = {
  categories: (includeInactive = true) =>
    apiFetch<Category[]>(
      '/categories' + toQueryString({ includeInactive, withProductCount: true }),
    ),

  category: (id: string) => apiFetch<CategoryDetail>('/categories/' + id),

  createCategory: (input: CategoryInput) =>
    apiFetch<Category>('/categories', { method: 'POST', body: input }),

  updateCategory: (id: string, input: Partial<CategoryInput>) =>
    apiFetch<Category>('/categories/' + id, { method: 'PATCH', body: input }),

  setCategoryStatus: (id: string, isActive: boolean) =>
    apiFetch<Category>('/categories/' + id + '/status', {
      method: 'PATCH',
      body: { isActive },
    }),

  reorderCategories: (categories: Array<{ id: string; displayOrder: number }>) =>
    apiFetch<{ updated: number }>('/categories/reorder', {
      method: 'PATCH',
      body: { categories },
    }),

  deleteCategory: (id: string) =>
    apiFetch<{ deleted: true; id: string }>('/categories/' + id, { method: 'DELETE' }),

  products: (query: ProductQuery) =>
    apiFetch<Paginated<Product>>('/products' + toQueryString({ ...query, includeInactive: true })),

  product: (id: string) => apiFetch<ProductDetail>('/products/' + id),

  createProduct: (input: ProductInput) =>
    apiFetch<ProductDetail>('/products', { method: 'POST', body: input }),

  updateProduct: (id: string, input: Partial<ProductInput>) =>
    apiFetch<ProductDetail>('/products/' + id, { method: 'PATCH', body: input }),

  setProductStatus: (id: string, isActive: boolean) =>
    apiFetch<ProductDetail>('/products/' + id + '/status', {
      method: 'PATCH',
      body: { isActive },
    }),

  deleteProduct: (id: string) =>
    apiFetch<{ deleted: true; id: string }>('/products/' + id, { method: 'DELETE' }),

  inventory: (query: { page?: number; limit?: number; search?: string; lowStockOnly?: boolean }) =>
    apiFetch<Paginated<InventoryRow>>('/inventory' + toQueryString(query)),

  updateInventory: (
    productId: string,
    input: { quantity?: number; adjustBy?: number; lowStockThreshold?: number; reason?: string },
  ) => apiFetch<StockUpdateResult>('/inventory/' + productId, { method: 'PATCH', body: input }),

  // --- Control centre ----------------------------------------------------
  //
  // One request for the dashboard, not one per tile. Everything below hangs
  // off `/admin`, except products, categories and stores, which reuse the
  // routes above — the API deliberately does not maintain two endpoints for
  // the same operation.

  dashboard: () => apiFetch<AdminDashboard>('/admin/dashboard'),

  /**
   * Uploads one product photograph.
   *
   * FormData is passed through the client untouched and WITHOUT a Content-Type
   * header — the browser sets it including the multipart boundary, and setting
   * it by hand produces a body no server can parse.
   */
  uploadProductImage: (file: File) => {
    const body = new FormData();
    body.append('image', file);
    return apiFetch<StoredImage>('/admin/media/product-image', { method: 'POST', body });
  },

  // --- Orders ------------------------------------------------------------

  orders: (query: AdminOrderQuery) =>
    apiFetch<Paginated<AdminOrderSummary>>(
      '/admin/orders' + toQueryString({ ...query, limit: 20 }),
    ),

  order: (id: string) => apiFetch<AdminOrderDetail>('/admin/orders/' + id),

  /** The reason is mandatory: the server refuses an override without one. */
  overrideOrderStatus: (id: string, input: { status: OrderStatus; reason: string }) =>
    apiFetch<AdminOrderDetail>('/admin/orders/' + id + '/status', {
      method: 'PATCH',
      body: input,
    }),

  // --- Customers ---------------------------------------------------------

  customers: (query: { page?: number; search?: string; isActive?: boolean }) =>
    apiFetch<Paginated<AdminCustomerSummary>>(
      '/admin/customers' + toQueryString({ ...query, limit: 20 }),
    ),

  customer: (id: string) => apiFetch<AdminCustomerDetail>('/admin/customers/' + id),

  setCustomerStatus: (id: string, isActive: boolean) =>
    apiFetch<AdminCustomerSummary>('/admin/customers/' + id + '/status', {
      method: 'PATCH',
      body: { isActive },
    }),

  // --- Store managers ----------------------------------------------------

  storeManagers: (query: { page?: number; search?: string; isActive?: boolean }) =>
    apiFetch<Paginated<AdminStoreManager>>(
      '/admin/store-managers' + toQueryString({ ...query, limit: 20 }),
    ),

  createStoreManager: (input: CreateStoreManagerInput) =>
    apiFetch<AdminStoreManager>('/admin/store-managers', { method: 'POST', body: input }),

  updateStoreManager: (id: string, input: UpdateStoreManagerInput) =>
    apiFetch<AdminStoreManager>('/admin/store-managers/' + id, { method: 'PATCH', body: input }),

  setStoreManagerStatus: (id: string, isActive: boolean) =>
    apiFetch<AdminStoreManager>('/admin/store-managers/' + id + '/status', {
      method: 'PATCH',
      body: { isActive },
    }),

  // --- Stores ------------------------------------------------------------
  // The existing ADMIN-guarded `/stores` routes, not a parallel admin copy.

  stores: () => apiFetch<AdminStore[]>('/stores' + toQueryString({ includeInactive: true })),

  store: (id: string) => apiFetch<AdminStore>('/stores/' + id),

  createStore: (input: StoreInput) =>
    apiFetch<AdminStore>('/stores', { method: 'POST', body: input }),

  updateStore: (id: string, input: Partial<StoreInput>) =>
    apiFetch<AdminStore>('/stores/' + id, { method: 'PATCH', body: input }),

  // --- Delivery pricing --------------------------------------------------

  deliveryRules: () => apiFetch<DeliveryRuleSet>('/admin/delivery/pricing-rules'),

  createDeliveryRule: (input: DeliveryRuleInput) =>
    apiFetch<DeliveryRule>('/admin/delivery/pricing-rules', { method: 'POST', body: input }),

  updateDeliveryRule: (id: string, input: Partial<DeliveryRuleInput>) =>
    apiFetch<DeliveryRule>('/admin/delivery/pricing-rules/' + id, {
      method: 'PATCH',
      body: input,
    }),

  deleteDeliveryRule: (id: string) =>
    apiFetch<{ deleted: true; id: string }>('/admin/delivery/pricing-rules/' + id, {
      method: 'DELETE',
    }),

  // --- Settings & audit --------------------------------------------------

  settings: () => apiFetch<PlatformSettings>('/admin/settings'),

  updateSettings: (input: PlatformSettingsInput) =>
    apiFetch<PlatformSettings>('/admin/settings', { method: 'PATCH', body: input }),

  auditLogs: (query: { page?: number; action?: string; entityType?: string; entityId?: string }) =>
    apiFetch<Paginated<AuditLogEntry>>(
      '/admin/audit-logs' + toQueryString({ ...query, limit: 20 }),
    ),
};
