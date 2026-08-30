'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Paginated, Product, ProductQuery } from '@/types/catalog';
import { catalogApi } from './catalog.api';

/**
 * Query keys live in one place so a mutation elsewhere can invalidate exactly
 * the right slice of cache instead of guessing at a string.
 */
export const catalogKeys = {
  all: ['catalog'] as const,
  store: () => [...catalogKeys.all, 'store'] as const,
  categories: (params: object = {}) => [...catalogKeys.all, 'categories', params] as const,
  category: (slug: string) => [...catalogKeys.all, 'category', slug] as const,
  products: (query: ProductQuery) => [...catalogKeys.all, 'products', query] as const,
  product: (slug: string) => [...catalogKeys.all, 'product', slug] as const,
  related: (slug: string) => [...catalogKeys.all, 'related', slug] as const,
  brands: () => [...catalogKeys.all, 'brands'] as const,
};

/** The catalogue changes rarely; a long stale time keeps browsing snappy. */
const CATALOG_STALE_TIME = 5 * 60_000;

export function useCurrentStore() {
  return useQuery({
    queryKey: catalogKeys.store(),
    queryFn: catalogApi.currentStore,
    staleTime: 30 * 60_000,
  });
}

export function useCategories(params: { withProductCount?: boolean } = {}) {
  return useQuery({
    queryKey: catalogKeys.categories(params),
    queryFn: () => catalogApi.categories(params),
    staleTime: CATALOG_STALE_TIME,
  });
}

export function useCategory(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.category(slug ?? ''),
    queryFn: () => catalogApi.category(slug as string),
    enabled: Boolean(slug),
    staleTime: CATALOG_STALE_TIME,
  });
}

/** A single page — used by the home page rails, which never paginate. */
export function useProducts(query: ProductQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: () => catalogApi.products(query),
    enabled: options.enabled ?? true,
    staleTime: CATALOG_STALE_TIME,
  });
}

/**
 * Paged listing for the browse and search screens.
 *
 * Pagination is entirely server-side: each page is a separate request with its
 * own `limit`, so a large catalogue never arrives in one response.
 */
export function useProductList(query: ProductQuery) {
  return useInfiniteQuery({
    queryKey: catalogKeys.products(query),
    queryFn: ({ pageParam }) => catalogApi.products({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: Paginated<Product>) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    staleTime: CATALOG_STALE_TIME,
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.product(slug ?? ''),
    queryFn: () => catalogApi.product(slug as string),
    enabled: Boolean(slug),
    staleTime: CATALOG_STALE_TIME,
  });
}

export function useRelatedProducts(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.related(slug ?? ''),
    queryFn: () => catalogApi.relatedProducts(slug as string),
    enabled: Boolean(slug),
    staleTime: CATALOG_STALE_TIME,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: catalogKeys.brands(),
    queryFn: catalogApi.brands,
    staleTime: CATALOG_STALE_TIME,
  });
}

/** Flattens infinite-query pages into the single list a grid renders. */
export function flattenPages(pages: Array<Paginated<Product>> | undefined): Product[] {
  return (pages ?? []).flatMap((page) => page.items);
}
