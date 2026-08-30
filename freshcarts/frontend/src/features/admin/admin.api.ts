import { toQueryString } from '@/features/catalog/catalog.api';
import { apiFetch } from '@/lib/api/client';
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
};
