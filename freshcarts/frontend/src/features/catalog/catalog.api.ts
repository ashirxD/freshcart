import { apiFetch } from '@/lib/api/client';
import type {
  Category,
  CategoryDetail,
  Paginated,
  Product,
  ProductDetail,
  ProductQuery,
  Store,
} from '@/types/catalog';

/**
 * Builds a query string from a filter object, dropping anything unset.
 *
 * Omitting empties matters beyond tidiness: it keeps the URL — and therefore
 * the TanStack Query cache key — identical for two requests that mean the same
 * thing, instead of splitting the cache on `?brand=`.
 */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? '?' + query : '';
}

/** Transport only. Caching, retries and error messaging belong to the hooks. */
export const catalogApi = {
  currentStore: () => apiFetch<Store>('/stores/current'),

  categories: (params: { withProductCount?: boolean; flat?: boolean; parent?: string } = {}) =>
    apiFetch<Category[]>('/categories' + toQueryString(params)),

  category: (idOrSlug: string) =>
    apiFetch<CategoryDetail>('/categories/' + encodeURIComponent(idOrSlug)),

  products: (query: ProductQuery) =>
    apiFetch<Paginated<Product>>('/products' + toQueryString({ ...query })),

  product: (idOrSlug: string) =>
    apiFetch<ProductDetail>('/products/' + encodeURIComponent(idOrSlug)),

  relatedProducts: (idOrSlug: string) =>
    apiFetch<Product[]>('/products/' + encodeURIComponent(idOrSlug) + '/related'),

  brands: () => apiFetch<string[]>('/products/brands'),
};
