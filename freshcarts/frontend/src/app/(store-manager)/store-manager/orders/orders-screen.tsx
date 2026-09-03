'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Search } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { StoreOrderRow } from '@/components/store-manager/store-order-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreOrders } from '@/features/store-manager/store-manager.hooks';
import { cn } from '@/lib/cn';
import type { FulfillmentMethod, OrderStatus } from '@/types/order';

/**
 * The status filters, in workflow order.
 *
 * "Needs action" comes first because it is the one staff use all day: it is the
 * server's own definition of "the store is holding this up", so the tab and the
 * dashboard count can never disagree.
 */
const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'NEEDS_ACTION', label: 'Needs action' },
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REJECTED', label: 'Rejected' },
];

const FULFILLMENT_TABS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'PICKUP', label: 'Pickup' },
];

/**
 * The order queue.
 *
 * Filters live in the URL so a manager can keep "pending deliveries" open in a
 * tab, share it with a colleague, and have back/forward behave. The query key is
 * derived from the same place, so the address bar and the cache cannot drift.
 */
export function OrdersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status') ?? 'NEEDS_ACTION';
  const fulfillmentParam = searchParams.get('fulfillment') ?? 'ALL';
  const orderNumberParam = searchParams.get('orderNumber') ?? '';
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;

  const [orderNumberInput, setOrderNumberInput] = useState(orderNumberParam);

  const setParam = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'ALL') params.delete(key);
        else params.set(key, value);
      }

      // Any filter change invalidates the page number — staying on page 4 of a
      // new result set shows an empty screen.
      if (!('page' in updates)) params.delete('page');

      const query = params.toString();
      router.replace(pathname + (query ? '?' + query : ''), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const query = useMemo(
    () => ({
      ...(statusParam === 'NEEDS_ACTION'
        ? { needsAction: true }
        : statusParam === 'ALL'
          ? {}
          : { status: statusParam as OrderStatus }),
      ...(fulfillmentParam !== 'ALL'
        ? { fulfillmentMethod: fulfillmentParam as FulfillmentMethod }
        : {}),
      ...(orderNumberParam ? { orderNumber: orderNumberParam } : {}),
      page,
      limit: 20,
    }),
    [statusParam, fulfillmentParam, orderNumberParam, page],
  );

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useStoreOrders(query);

  const pagination = data?.pagination;

  return (
    <Container className="gap-loose flex flex-col">
      <header className="gap-gutter flex flex-wrap items-end justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-text text-xl font-semibold">Orders</h1>
          <p aria-live="polite" className="text-text-muted text-sm">
            {isPending
              ? 'Loading orders…'
              : pagination
                ? pagination.total === 1
                  ? '1 order'
                  : pagination.total + ' orders'
                : ''}
          </p>
        </div>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setParam({ orderNumber: orderNumberInput.trim() || undefined });
          }}
          className="gap-tight flex items-end"
        >
          <Input
            label="Order number"
            placeholder="FC-2026-…"
            value={orderNumberInput}
            onChange={(event) => setOrderNumberInput(event.target.value)}
            className="max-w-44"
          />
          <Button
            type="submit"
            variant="outline"
            leadingIcon={<Search className="size-4" aria-hidden="true" />}
          >
            Find
          </Button>
        </form>
      </header>

      <FilterRow
        legend="Status"
        options={STATUS_TABS}
        selected={statusParam}
        onSelect={(value) => setParam({ status: value === 'NEEDS_ACTION' ? undefined : value })}
      />

      <FilterRow
        legend="Fulfilment"
        options={FULFILLMENT_TABS}
        selected={fulfillmentParam}
        onSelect={(value) => setParam({ fulfillment: value })}
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" label="Loading orders" />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7" aria-hidden="true" />}
          title="No orders found"
          description={
            orderNumberParam
              ? 'No order in this store matches “' + orderNumberParam + '”.'
              : 'Nothing matches these filters. Try widening them.'
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <ul
          className={cn(
            'flex list-none flex-col gap-2 transition-opacity',
            // A refetch under the reader's hands dims rather than blanks.
            isPlaceholderData && 'opacity-60',
          )}
        >
          {data.items.map((order) => (
            <StoreOrderRow key={order.id} order={order} />
          ))}
        </ul>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <nav aria-label="Order pages" className="gap-gutter flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
          >
            Previous
          </Button>

          <span aria-live="polite" className="text-text-muted text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </Container>
  );
}

/**
 * A row of filter chips as a radio group.
 *
 * `role="radiogroup"` with `aria-checked` rather than a row of buttons: this is
 * a single-choice control, and announcing it as one is the difference between
 * "eleven buttons" and "Status, Pending selected, 3 of 11".
 */
function FilterRow({
  legend,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="gap-tight flex flex-col">
      <span className="text-text-muted text-xs font-semibold tracking-wide uppercase">
        {legend}
      </span>

      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === selected;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(option.value)}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface text-text hover:bg-surface-muted',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
