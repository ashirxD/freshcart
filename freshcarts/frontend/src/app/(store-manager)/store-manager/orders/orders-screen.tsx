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
import { useI18n, useT, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/cn';
import type { FulfillmentMethod, OrderStatus } from '@/types/order';

/**
 * The status filters, in workflow order.
 *
 * "Needs action" comes first because it is the one staff use all day: it is the
 * server's own definition of "the store is holding this up", so the tab and the
 * dashboard count can never disagree.
 */
interface FilterOption {
  value: string;
  labelKey: TranslationKey;
}

const STATUS_TABS: FilterOption[] = [
  { value: 'NEEDS_ACTION', labelKey: 'store.filter.NEEDS_ACTION' },
  { value: 'ALL', labelKey: 'common.all' },
  { value: 'PENDING', labelKey: 'store.filter.PENDING' },
  { value: 'CONFIRMED', labelKey: 'store.filter.CONFIRMED' },
  { value: 'PREPARING', labelKey: 'store.filter.PREPARING' },
  { value: 'PACKED', labelKey: 'store.filter.PACKED' },
  { value: 'READY_FOR_PICKUP', labelKey: 'store.filter.READY_FOR_PICKUP' },
  { value: 'OUT_FOR_DELIVERY', labelKey: 'store.filter.OUT_FOR_DELIVERY' },
  { value: 'DELIVERED', labelKey: 'store.filter.DELIVERED' },
  { value: 'CANCELLED', labelKey: 'store.filter.CANCELLED' },
  { value: 'REJECTED', labelKey: 'store.filter.REJECTED' },
];

const FULFILLMENT_TABS: FilterOption[] = [
  { value: 'ALL', labelKey: 'common.all' },
  { value: 'DELIVERY', labelKey: 'store.fulfillment.DELIVERY' },
  { value: 'PICKUP', labelKey: 'store.fulfillment.PICKUP' },
];

/**
 * The order queue.
 *
 * Filters live in the URL so a manager can keep "pending deliveries" open in a
 * tab, share it with a colleague, and have back/forward behave. The query key is
 * derived from the same place, so the address bar and the cache cannot drift.
 */
export function OrdersScreen() {
  const { t, ltr } = useI18n();
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
          <h1 className="text-text text-xl font-semibold">{t('store.orders.title')}</h1>
          <p aria-live="polite" className="text-text-muted text-sm">
            {isPending
              ? t('store.orders.loading')
              : pagination
                ? t('store.orders.count', { count: pagination.total })
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
            label={t('store.orders.orderNumber')}
            placeholder={t('store.orders.orderNumberPlaceholder')}
            ltr
            value={orderNumberInput}
            onChange={(event) => setOrderNumberInput(event.target.value)}
            className="max-w-44"
          />
          <Button
            type="submit"
            variant="outline"
            leadingIcon={<Search className="size-4" aria-hidden="true" />}
          >
            {t('store.orders.find')}
          </Button>
        </form>
      </header>

      <FilterRow
        legend={t('store.orders.statusLegend')}
        options={STATUS_TABS}
        selected={statusParam}
        onSelect={(value) => setParam({ status: value === 'NEEDS_ACTION' ? undefined : value })}
      />

      <FilterRow
        legend={t('store.fulfillment.label')}
        options={FULFILLMENT_TABS}
        selected={fulfillmentParam}
        onSelect={(value) => setParam({ fulfillment: value })}
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" label={t('store.dashboard.loadingOrders')} />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7" aria-hidden="true" />}
          title={t('store.orders.emptyTitle')}
          description={
            orderNumberParam
              ? t('store.orders.emptyForNumber', { term: ltr(orderNumberParam) })
              : t('store.orders.emptyForFilters')
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
        <nav aria-label={t('store.orders.pagesLabel')} className="gap-gutter flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
          >
            {t('common.previous')}
          </Button>

          <span aria-live="polite" className="text-text-muted text-sm">
            {t('common.page', { page: pagination.page, pages: pagination.totalPages })}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
          >
            {t('common.next')}
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
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const t = useT();

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
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
