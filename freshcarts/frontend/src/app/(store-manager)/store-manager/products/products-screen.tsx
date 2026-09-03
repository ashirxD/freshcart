'use client';

import { useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { Container } from '@/components/layout/container';
import { AvailabilityBadge } from '@/components/product/badges';
import { ProductImage } from '@/components/product/product-image';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSetProductAvailability,
  useStoreProducts,
} from '@/features/store-manager/store-manager.hooks';
import { formatPkr } from '@/lib/format';
import type { Product } from '@/types/catalog';

/**
 * The store's products, from an operations point of view.
 *
 * Deliberately not the admin product manager. A manager can see everything and
 * change one thing: whether a product is on sale today. Pricing, categories,
 * SKUs and product creation stay with ADMIN (§37) — and they stay there because
 * there is no route here that could change them, not because this screen chooses
 * to hide the controls.
 */
export function ProductsScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<Product | null>(null);

  const { data, isPending, isError, error, refetch } = useStoreProducts({
    search: search || undefined,
    page,
    limit: 20,
  });

  return (
    <Container className="gap-loose flex flex-col">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-text text-xl font-semibold">Products</h1>
        <p aria-live="polite" className="text-text-muted text-sm">
          {isPending
            ? 'Loading products…'
            : data
              ? data.pagination.total + ' products in your store'
              : ''}
        </p>
      </header>

      <SearchBar
        placeholder="Search by name, brand or item code"
        onSearch={(term) => {
          setSearch(term);
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
        <EmptyState
          icon={<PackageSearch className="size-7" aria-hidden="true" />}
          title="No products found"
          description={
            search ? 'Nothing matches “' + search + '”.' : 'Your store has no products yet.'
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex list-none flex-col gap-2">
          {data.items.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              onTakeOffSale={() => setConfirming(product)}
            />
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

      <TakeOffSaleDialog product={confirming} onClose={() => setConfirming(null)} />
    </Container>
  );
}

function ProductRow({ product, onTakeOffSale }: { product: Product; onTakeOffSale: () => void }) {
  const setAvailability = useSetProductAvailability();

  return (
    <li className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-wrap items-center rounded-lg border">
      <div className="bg-surface-muted relative size-12 shrink-0 overflow-hidden rounded-md">
        <ProductImage
          image={product.primaryImage}
          name={product.name}
          sizes="48px"
          className="size-full"
        />
      </div>

      <div className="flex min-w-40 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-text text-sm font-semibold">{product.name}</h2>
          {!product.isActive ? (
            <span className="bg-surface-sunken text-text-muted rounded-full px-2 py-0.5 text-xs font-semibold">
              Off sale
            </span>
          ) : null}
        </div>

        <p className="text-text-muted text-xs">
          {product.sku} · {product.unitLabel}
          {product.brand ? ' · ' + product.brand : ''}
        </p>

        <AvailabilityBadge stock={product.stock} />
      </div>

      <p className="text-text shrink-0 font-semibold tabular-nums">
        {formatPkr(product.sellingPrice)}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {/*
          Carries the SKU through as the inventory search, so this lands on the
          row for *this* product rather than on the whole list — a link labelled
          "Stock" that shows everything is worse than no link.
        */}
        <ButtonLink
          href={'/store-manager/inventory?search=' + encodeURIComponent(product.sku)}
          variant="ghost"
          size="sm"
          aria-label={'Stock for ' + product.name}
        >
          Stock
        </ButtonLink>

        {product.isActive ? (
          // Taking a product off sale removes it from the customer catalogue
          // immediately, so it confirms first (§43).
          <Button variant="outline" size="sm" onClick={onTakeOffSale}>
            Take off sale
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            isLoading={setAvailability.isPending}
            onClick={() => setAvailability.mutate({ id: product.id, availability: 'AVAILABLE' })}
          >
            Put on sale
          </Button>
        )}
      </div>
    </li>
  );
}

function TakeOffSaleDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const setAvailability = useSetProductAvailability();

  if (!product) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Take off sale"
      description={product.name}
      footer={
        <div className="gap-gutter flex">
          <Button
            variant="danger"
            fullWidth
            isLoading={setAvailability.isPending}
            onClick={() =>
              setAvailability.mutate(
                { id: product.id, availability: 'UNAVAILABLE' },
                { onSuccess: onClose },
              )
            }
          >
            Take off sale
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            Keep on sale
          </Button>
        </div>
      }
    >
      <p className="text-text-muted text-sm">
        Customers will stop seeing this product straight away. It is not deleted — its stock,
        history and past orders are untouched, and you can put it back on sale at any time.
      </p>
    </Modal>
  );
}
