'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { flattenPages, useBrands, useProductList } from '@/features/catalog/catalog.hooks';
import { useCatalogFilters } from '@/features/catalog/use-catalog-filters';
import { cn } from '@/lib/cn';
import type { Category, ProductQuery } from '@/types/catalog';
import { FilterPanel } from './filter-panel';
import { SortSelector } from './sort-selector';

export interface ProductBrowserProps {
  /** Fixed part of the query, e.g. the category being browsed. */
  baseQuery?: ProductQuery;
  /** Offered as a "Type" filter when browsing a category. */
  subcategories?: Category[];
  /** Rendered when the filters match nothing — each screen suggests a way out. */
  emptyState: ReactNode;
  className?: string;
}

/**
 * The full browse experience: filters, sorting, paged results and every state
 * in between. Shared by the category and search screens so the two behave
 * identically rather than drifting into two half-implementations.
 *
 * Filter state comes from the URL, and paging is server-side — the browser only
 * ever holds the pages a shopper has actually asked for.
 *
 * The desktop filter rail is now a card that sticks as the results scroll past
 * it: a long grid used to leave the filters far above the viewport, so changing
 * one meant scrolling all the way back up. The results toolbar sticks too, for
 * the same reason.
 */
export function ProductBrowser({
  baseQuery = {},
  subcategories = [],
  emptyState,
  className,
}: ProductBrowserProps) {
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);
  const { filters, setFilters, clearFilters, activeFilterCount } = useCatalogFilters();
  const { data: brands = [] } = useBrands();

  const query: ProductQuery = { ...baseQuery, ...filters, limit: 20 };

  const {
    data,
    error,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductList(query);

  const products = flattenPages(data?.pages);
  const total = data?.pages[0]?.pagination.total ?? 0;

  const filterPanel = (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      onClear={clearFilters}
      brands={brands}
      subcategories={subcategories}
    />
  );

  return (
    <div className={cn('gap-loose flex flex-col lg:flex-row lg:items-start', className)}>
      {/* Desktop keeps filters permanently visible; there is room for them. */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="ring-outline-variant bg-surface p-gutter shadow-card sticky top-24 rounded-2xl ring-1">
          <h2 className="mb-gutter text-text text-base font-bold tracking-[-0.015em]">Filters</h2>
          {filterPanel}
        </div>
      </aside>

      <div className="gap-gutter flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            'bg-background/90 -mx-2 flex flex-wrap items-center justify-between gap-2 px-2 py-1',
            'sticky top-14 z-20 backdrop-blur-sm md:top-[4.25rem]',
          )}
        >
          {/* Announced politely so a screen-reader user hears the result count
              change after applying a filter, without losing their place. */}
          <p aria-live="polite" className="text-text-muted text-sm font-medium">
            {isPending ? 'Loading products…' : total === 1 ? '1 product' : total + ' products'}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterSheetOpen(true)}
              leadingIcon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
              className="lg:hidden"
            >
              Filters
              {activeFilterCount > 0 ? (
                <span className="bg-primary text-on-primary ms-1 rounded-full px-1.5 text-xs font-bold">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <SortSelector value={filters.sort} onChange={(sort) => setFilters({ sort })} />
          </div>
        </div>

        {isPending ? <ProductGridSkeleton /> : null}

        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {!isPending && !isError && products.length === 0 ? emptyState : null}

        {products.length > 0 ? (
          <>
            <ProductGrid products={products} />

            {hasNextPage ? (
              <div className="pt-loose flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void fetchNextPage()}
                  isLoading={isFetchingNextPage}
                >
                  Load more products
                </Button>
              </div>
            ) : (
              <p className="pt-loose text-text-muted flex items-center justify-center gap-2 text-center text-sm">
                <span aria-hidden="true" className="shelf-rule h-px w-12" />
                That is all {total === 1 ? '1 product' : total + ' products'}
                <span aria-hidden="true" className="shelf-rule h-px w-12" />
              </p>
            )}
          </>
        ) : null}
      </div>

      {/* Mobile filters as a bottom sheet — reachable with a thumb, and it
          leaves the results visible behind it. */}
      <Modal
        open={isFilterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filters"
        description="Narrow down what you are looking for"
        footer={
          <Button fullWidth onClick={() => setFilterSheetOpen(false)}>
            Show {total === 1 ? '1 product' : total + ' products'}
          </Button>
        }
      >
        {filterPanel}
      </Modal>
    </div>
  );
}
