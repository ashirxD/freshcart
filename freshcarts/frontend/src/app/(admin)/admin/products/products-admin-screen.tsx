'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { StatusPill } from '@/components/admin/status-pill';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { Container } from '@/components/layout/container';
import { AvailabilityBadge } from '@/components/product/badges';
import { ProductImage } from '@/components/product/product-image';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminProducts,
  useDeleteProduct,
  useSetProductStatus,
} from '@/features/admin/admin.hooks';
import { formatPkr } from '@/lib/format';

/**
 * The product catalogue, including deactivated products.
 *
 * This reads the same `GET /products` the storefront uses — an admin token
 * simply unlocks `includeInactive`, so there is no parallel admin listing to
 * keep in sync.
 */
export function ProductsAdminScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch } = useAdminProducts({
    search: search || undefined,
    page,
    limit: 20,
    sort: 'name_asc',
  });

  const setStatus = useSetProductStatus();
  const remove = useDeleteProduct();

  return (
    <Container className="gap-loose flex flex-col">
      <header className="gap-gutter flex flex-wrap items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-text text-xl font-semibold">Products</h1>
          <p className="text-text-muted text-sm">
            {data ? data.pagination.total + ' products in the catalogue' : 'Loading…'}
          </p>
        </div>

        <ButtonLink
          href="/admin/products/new"
          leadingIcon={<Plus className="size-4" aria-hidden="true" />}
        >
          New product
        </ButtonLink>
      </header>

      <SearchBar
        placeholder="Search by name, brand or item code"
        onSearch={(term) => {
          setSearch(term);
          // A new search means a new result set; staying on page 4 would show
          // an empty page.
          setPage(1);
        }}
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" label="Loading products" />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.items.length === 0 ? (
        <p className="bg-surface-muted p-loose text-text-muted rounded-lg text-center text-sm">
          {search
            ? 'No products match “' + search + '”.'
            : 'No products yet. Create the first one to start selling.'}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.items.map((product) => (
            <li
              key={product.id}
              className="gap-gutter border-outline-variant bg-surface p-gutter flex flex-wrap items-center rounded-lg border"
            >
              <div className="bg-surface-muted relative size-14 shrink-0 overflow-hidden rounded-md">
                <ProductImage
                  image={product.primaryImage}
                  name={product.name}
                  sizes="56px"
                  className="size-full"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-text text-sm font-semibold">{product.name}</h2>
                  <StatusPill isActive={product.isActive} />
                  {product.isFeatured ? (
                    <span className="bg-secondary-container text-on-secondary-container rounded-full px-2 py-0.5 text-xs font-semibold">
                      Featured
                    </span>
                  ) : null}
                </div>

                <p className="text-text-muted text-xs">
                  {product.sku} · {product.unitLabel}
                  {product.brand ? ' · ' + product.brand : ''}
                </p>

                <AvailabilityBadge stock={product.stock} />
              </div>

              <p className="text-text font-semibold tabular-nums">
                {formatPkr(product.sellingPrice)}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <ButtonLink href={'/admin/products/' + product.id} variant="outline" size="sm">
                  Edit
                </ButtonLink>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatus.mutate({ id: product.id, isActive: !product.isActive })}
                >
                  {product.isActive ? 'Deactivate' : 'Activate'}
                </Button>

                <Button variant="ghost" size="sm" onClick={() => remove.mutate(product.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <nav aria-label="Product pages" className="gap-gutter flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>

          <span aria-live="polite" className="text-text-muted text-sm">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </Container>
  );
}
