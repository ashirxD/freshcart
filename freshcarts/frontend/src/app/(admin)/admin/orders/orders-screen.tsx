'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AdminListState,
  AdminPageHeader,
  FilterChips,
  Pagination,
  TableScroller,
} from '@/components/admin/admin-page';
import { SearchBar } from '@/components/common/search-bar';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { SelectField } from '@/components/admin/form-field';
import { Ltr, Money } from '@/components/common/ltr';
import { useAdminOrders, useAdminStores } from '@/features/admin/admin.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { formatPkr } from '@/lib/format';
import type { AdminOrderQuery, AdminOrderSummary } from '@/types/admin';
import type { OrderStatus } from '@/types/order';

/** The filters staff actually reach for, in the order they reach for them. */
const STATUS_FILTERS = [
  { value: '' as const, labelKey: 'common.all' as TranslationKey },
  { value: 'NEEDS_ACTION' as const, labelKey: 'admin.orders.filterNeedsAction' as TranslationKey },
  { value: 'PENDING' as const, labelKey: 'admin.orders.filterNew' as TranslationKey },
  { value: 'PREPARING' as const, labelKey: 'admin.orders.filterPreparing' as TranslationKey },
  { value: 'OUT_FOR_DELIVERY' as const, labelKey: 'admin.orders.filterOnTheWay' as TranslationKey },
  { value: 'READY_FOR_PICKUP' as const, labelKey: 'admin.orders.filterReady' as TranslationKey },
  { value: 'DELIVERED' as const, labelKey: 'admin.orders.filterCompleted' as TranslationKey },
  { value: 'CANCELLED' as const, labelKey: 'admin.orders.filterCancelled' as TranslationKey },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

/**
 * EVERY STORE'S ORDERS
 *
 * The one thing this screen has that the store console does not is the store
 * column and the store filter. Everything else — the status vocabulary, the
 * totals, the badge — is the same projection, so the two surfaces cannot drift
 * into describing the same order differently.
 *
 * The query is server-side and paginated: there is no client-side filtering of
 * a fully-loaded list anywhere here, because an order collection grows without
 * bound (section 90).
 */
export function AdminOrdersScreen() {
  const { t } = useI18n();
  const params = useSearchParams();

  // Deep links from the dashboard land here with a filter already applied.
  const initialStatus = (params.get('status') ?? (params.get('needsAction') ? 'NEEDS_ACTION' : '')) as StatusFilter;

  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const stores = useAdminStores();

  const query: AdminOrderQuery = {
    page,
    ...(status === 'NEEDS_ACTION'
      ? { needsAction: true }
      : status
        ? { status: status as OrderStatus }
        : {}),
    ...(storeId ? { storeId } : {}),
    // An order number is what a customer reads out on the phone; anything else
    // typed here is a name. Sending both lets the server decide.
    ...(search ? (isOrderNumber(search) ? { orderNumber: search } : { customer: search }) : {}),
  };

  const { data, isPending, isError, error, refetch } = useAdminOrders(query);

  const reset = () => setPage(1);

  return (
    <>
      <AdminPageHeader
        title={t('admin.orders.title')}
        description={
          data
            ? t('admin.orders.matching', { count: data.pagination.total })
            : t('admin.orders.acrossStores')
        }
      />

      <div className="gap-gutter mb-gutter flex flex-wrap items-end">
        <SearchBar
          label={t('admin.orders.searchLabel')}
          placeholder={t('admin.orders.searchPlaceholder')}
          className="min-w-64 flex-1"
          onSearch={(term) => {
            setSearch(term);
            reset();
          }}
        />

        {/* Only shown when there is more than one store to choose between. */}
        {stores.data && stores.data.length > 1 ? (
          <SelectField
            label={t('admin.orders.store')}
            className="max-w-56"
            placeholder={t('admin.orders.everyStore')}
            value={storeId}
            onChange={(event) => {
              setStoreId(event.target.value);
              reset();
            }}
            options={stores.data.map((store) => ({ value: store.id, label: store.name }))}
          />
        ) : null}
      </div>

      <div className="mb-gutter">
        <FilterChips
          label={t('admin.orders.filterLabel')}
          options={STATUS_FILTERS.map((filter) => ({
            value: filter.value,
            label: t(filter.labelKey),
          }))}
          value={status}
          onChange={(next) => {
            setStatus(next);
            reset();
          }}
        />
      </div>

      <AdminListState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={data?.items.length === 0}
        emptyTitle={t('admin.orders.emptyTitle')}
        emptyDescription={
          search || status || storeId
            ? t('admin.orders.emptyFiltered')
            : t('admin.orders.emptyNone')
        }
      >
        <TableScroller>
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">
              {t('admin.orders.caption')}
            </caption>

            <thead className="border-outline-variant text-text-muted border-b text-start">
              <tr>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.orders.colOrder')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.orders.colCustomer')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.orders.colStore')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.orders.colHow')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.orders.colStatus')}
                </th>
                <th scope="col" className="p-gutter text-end font-semibold">
                  {t('admin.orders.colTotal')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.orders.colPlaced')}
                </th>
              </tr>
            </thead>

            <tbody>
              {data?.items.map((order) => <OrderRow key={order.id} order={order} />)}
            </tbody>
          </table>
        </TableScroller>

        <Pagination
          label={t('admin.orders.pagesLabel')}
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          onPageChange={setPage}
        />
      </AdminListState>
    </>
  );
}

function OrderRow({ order }: { order: AdminOrderSummary }) {
  const { t, locale } = useI18n();

  return (
    <tr className="border-outline-variant hover:bg-surface-muted border-b last:border-0">
      <td className="p-gutter">
        <Link
          href={'/admin/orders/' + order.id}
          className="text-primary font-semibold tabular-nums underline-offset-2 hover:underline"
        >
          <Ltr>{order.orderNumber}</Ltr>
        </Link>
        <span className="text-text-muted block text-xs">
          {t('common.itemCount', { count: order.itemCount })}
        </span>
      </td>

      <td className="p-gutter">
        <span className="text-text block">
          <bdi>{order.customer.name}</bdi>
        </span>
        <span className="text-text-muted block text-xs tabular-nums">
          <Ltr>{order.customer.phone}</Ltr>
        </span>
      </td>

      <td className="p-gutter text-text-muted">
        <bdi>{order.store.name}</bdi>
      </td>

      {/* Shopper-facing wording, not the enum (section 46). */}
      <td className="p-gutter text-text-muted">
        {t(
          order.fulfillmentMethod === 'DELIVERY'
            ? 'store.fulfillment.DELIVERY'
            : 'store.fulfillment.PICKUP',
        )}
      </td>

      <td className="p-gutter">
        <OrderStatusBadge
          status={order.status}
          label={order.statusLabel}
          fulfillmentMethod={order.fulfillmentMethod}
        />
      </td>

      <td className="p-gutter text-text text-end font-semibold tabular-nums">
        <Money>{formatPkr(order.total)}</Money>
      </td>

      <td className="p-gutter text-text-muted whitespace-nowrap">
        {formatDate(order.placedAt, locale, 'shortDate')}
      </td>
    </tr>
  );
}

/** FC-2026-0000123 and partial prefixes of it. Anything else is a person. */
function isOrderNumber(term: string): boolean {
  return /^[A-Za-z]{2,6}-?\d/.test(term.trim());
}
