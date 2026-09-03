'use client';

import { useState } from 'react';
import { StatusPill } from '@/components/admin/status-pill';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminInventory, useUpdateInventory } from '@/features/admin/admin.hooks';
import { cn } from '@/lib/cn';
import type { InventoryRow } from '@/types/catalog';

/**
 * Stock management.
 *
 * Two ways to change a number, because they mean different things: an
 * adjustment (+12 on a delivery) is applied conditionally by the server and is
 * safe against two people working at once, while an absolute set is what a
 * stock take produces. The API refuses to accept both in one request.
 */
export function InventoryScreen() {
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch } = useAdminInventory({
    search: search || undefined,
    lowStockOnly: lowStockOnly || undefined,
    page,
  });

  return (
    <Container className="gap-loose flex flex-col">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-text text-xl font-semibold">Inventory</h1>
        <p className="text-text-muted text-sm">
          {data ? data.pagination.total + ' products tracked' : 'Loading…'} · Lowest stock first
        </p>
      </header>

      <div className="gap-gutter flex flex-wrap items-center">
        <SearchBar
          placeholder="Search by product name or item code"
          className="min-w-64 flex-1"
          onSearch={(term) => {
            setSearch(term);
            setPage(1);
          }}
        />

        <Button
          variant={lowStockOnly ? 'primary' : 'outline'}
          aria-pressed={lowStockOnly}
          onClick={() => {
            setLowStockOnly((current) => !current);
            setPage(1);
          }}
        >
          Running low only
        </Button>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" label="Loading stock levels" />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.items.length === 0 ? (
        <p className="bg-surface-muted p-loose text-text-muted rounded-lg text-center text-sm">
          {lowStockOnly
            ? 'Nothing is running low right now.'
            : 'No stock records match that search.'}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.items.map((row) => (
            <StockRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <nav aria-label="Inventory pages" className="gap-gutter flex items-center justify-center">
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

const STATUS_STYLES = {
  IN_STOCK: 'text-success',
  LOW_STOCK: 'text-secondary',
  OUT_OF_STOCK: 'text-danger',
} as const;

const STATUS_LABELS = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Running low',
  OUT_OF_STOCK: 'Out of stock',
} as const;

function StockRow({ row }: { row: InventoryRow }) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [threshold, setThreshold] = useState(String(row.lowStockThreshold));
  const update = useUpdateInventory();

  const isDirty = Number(quantity) !== row.quantity || Number(threshold) !== row.lowStockThreshold;

  return (
    <li className="gap-gutter border-outline-variant bg-surface p-gutter flex flex-wrap items-end rounded-lg border">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-text text-sm font-semibold">{row.productName}</h2>
          {!row.isProductActive ? <StatusPill isActive={false} /> : null}
        </div>

        <p className="text-text-muted text-xs">{row.sku}</p>

        <p className={cn('text-xs font-semibold', STATUS_STYLES[row.status])}>
          {STATUS_LABELS[row.status]} · {row.quantity} on hand
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          isLoading={update.isPending}
          onClick={() => update.mutate({ productId: row.productId, adjustBy: -1 })}
          disabled={row.quantity <= 0}
          aria-label={'Remove one ' + row.productName}
        >
          −1
        </Button>

        <Button
          variant="outline"
          size="sm"
          isLoading={update.isPending}
          onClick={() => update.mutate({ productId: row.productId, adjustBy: 10 })}
          aria-label={'Add ten ' + row.productName}
        >
          +10
        </Button>
      </div>

      <Input
        label="Set quantity"
        type="number"
        inputMode="numeric"
        min={0}
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className="max-w-24"
      />

      <Input
        label="Low stock at"
        type="number"
        inputMode="numeric"
        min={0}
        value={threshold}
        onChange={(event) => setThreshold(event.target.value)}
        className="max-w-24"
      />

      <Button
        size="sm"
        disabled={!isDirty}
        isLoading={update.isPending}
        onClick={() =>
          update.mutate({
            productId: row.productId,
            quantity: Number(quantity),
            lowStockThreshold: Number(threshold),
          })
        }
      >
        Save
      </Button>
    </li>
  );
}
