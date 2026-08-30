'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ProductSort } from '@/types/catalog';

export interface CatalogFilters {
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  discounted?: boolean;
  subcategory?: string;
  sort?: ProductSort;
}

const SORTS: ProductSort[] = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'discount',
  'name_asc',
];

function readNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Filter state lives in the URL, not in a store.
 *
 * That is what makes a filtered listing shareable, restorable on back/forward,
 * and correct after a refresh — and it means the TanStack Query key is derived
 * from the same source of truth the address bar shows, so the two cannot drift.
 */
export function useCatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<CatalogFilters>(() => {
    const sort = searchParams.get('sort');

    return {
      search: searchParams.get('q') ?? undefined,
      brand: searchParams.get('brand') ?? undefined,
      subcategory: searchParams.get('sub') ?? undefined,
      minPrice: readNumber(searchParams.get('min')),
      maxPrice: readNumber(searchParams.get('max')),
      inStock: searchParams.get('inStock') === 'true' ? true : undefined,
      discounted: searchParams.get('sale') === 'true' ? true : undefined,
      sort: sort && SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : undefined,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (next: Partial<CatalogFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      const apply = (key: string, value: string | number | boolean | undefined) => {
        if (value === undefined || value === '' || value === false) params.delete(key);
        else params.set(key, String(value));
      };

      if ('search' in next) apply('q', next.search);
      if ('brand' in next) apply('brand', next.brand);
      if ('subcategory' in next) apply('sub', next.subcategory);
      if ('minPrice' in next) apply('min', next.minPrice);
      if ('maxPrice' in next) apply('max', next.maxPrice);
      if ('inStock' in next) apply('inStock', next.inStock);
      if ('discounted' in next) apply('sale', next.discounted);
      if ('sort' in next) apply('sort', next.sort);

      const query = params.toString();

      // `replace`, not `push`: adjusting a filter should not stack history
      // entries a shopper has to tap "back" through to leave the page.
      router.replace(pathname + (query ? '?' + query : ''), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    // The search term is the query itself, not a filter — clearing filters must
    // not silently discard what the shopper was looking for.
    const term = searchParams.get('q');
    if (term) params.set('q', term);

    const query = params.toString();
    router.replace(pathname + (query ? '?' + query : ''), { scroll: false });
  }, [pathname, router, searchParams]);

  const activeFilterCount = [
    filters.brand,
    filters.subcategory,
    filters.minPrice,
    filters.maxPrice,
    filters.inStock,
    filters.discounted,
  ].filter((value) => value !== undefined).length;

  return { filters, setFilters, clearFilters, activeFilterCount };
}
