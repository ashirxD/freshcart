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
import { useAdminOrders, useAdminStores } from '@/features/admin/admin.hooks';
import { formatPkr } from '@/lib/format';
import type { AdminOrderQuery, AdminOrderSummary } from '@/types/admin';
import type { OrderStatus } from '@/types/order';

/** The filters staff actually reach for, in the order they reach for them. */
const STATUS_FILTERS = [
  { value: '' as const, label: 'All' },
  { value: 'NEEDS_ACTION' as const, label: 'Needs action' },
  { value: 'PENDING' as const, label: 'New' },
  { value: 'PREPARING' as const, label: 'Preparing' },
  { value: 'OUT_FOR_DELIVERY' as const, label: 'On the way' },
  { value: 'READY_FOR_PICKUP' as const, label: 'Ready' },
  { value: 'DELIVERED' as const, label: 'Completed' },
  { value: 'CANCELLED' as const, label: 'Cancelled' },
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
        title="Orders"
        description={
          data ? data.pagination.total + ' orders match these filters' : 'Across every store'
        }
      />

      <div className="gap-gutter mb-gutter flex flex-wrap items-end">
        <SearchBar
          label="Search orders"
          placeholder="Order number, or customer name or phone"
          className="min-w-64 flex-1"
          onSearch={(term) => {
            setSearch(term);
            reset();
          }}
        />

        {/* Only shown when there is more than one store to choose between. */}
        {stores.data && stores.data.length > 1 ? (
          <SelectField
            label="Store"
            className="max-w-56"
            placeholder="Every store"
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
          label="Filter by status"
          options={STATUS_FILTERS}
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
        emptyTitle="No orders match these filters"
        emptyDescription={
          search || status || storeId
            ? 'Try a different status, store or search term.'
            : 'Orders will appear here as customers place them.'
        }
      >
        <TableScroller>
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">
              Orders across every store, newest first. Each row links to the full order.
            </caption>

            <thead className="border-outline-variant text-text-muted border-b text-left">
              <tr>
                <th scope="col" className="p-gutter font-semibold">Order</th>
                <th scope="col" className="p-gutter font-semibold">Customer</th>
                <th scope="col" className="p-gutter font-semibold">Store</th>
                <th scope="col" className="p-gutter font-semibold">How</th>
                <th scope="col" className="p-gutter font-semibold">Status</th>
                <th scope="col" className="p-gutter text-right font-semibold">Total</th>
                <th scope="col" className="p-gutter font-semibold">Placed</th>
              </tr>
            </thead>

            <tbody>
              {data?.items.map((order) => <OrderRow key={order.id} order={order} />)}
            </tbody>
          </table>
        </TableScroller>

        <Pagination
          label="Order pages"
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          onPageChange={setPage}
        />
      </AdminListState>
    </>
  );
}

function OrderRow({ order }: { order: AdminOrderSummary }) {
  return (
    <tr className="border-outline-variant hover:bg-surface-muted border-b last:border-0">
      <td className="p-gutter">
        <Link
          href={'/admin/orders/' + order.id}
          className="text-primary font-semibold tabular-nums underline-offset-2 hover:underline"
        >
          {order.orderNumber}
        </Link>
        <span className="text-text-muted block text-xs">
          {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
        </span>
      </td>

      <td className="p-gutter">
        <span className="text-text block">{order.customer.name}</span>
        <span className="text-text-muted block text-xs tabular-nums">{order.customer.phone}</span>
      </td>

      <td className="p-gutter text-text-muted">{order.store.name}</td>

      {/* Shopper-facing wording, not the enum (section 46). */}
      <td className="p-gutter text-text-muted">
        {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}
      </td>

      <td className="p-gutter">
        <OrderStatusBadge status={order.status} label={order.statusLabel} />
      </td>

      <td className="p-gutter text-text text-right font-semibold tabular-nums">
        {formatPkr(order.total)}
      </td>

      <td className="p-gutter text-text-muted whitespace-nowrap">
        {new Date(order.placedAt).toLocaleDateString('en-PK', {
          day: 'numeric',
          month: 'short',
        })}
      </td>
    </tr>
  );
}

/** FC-2026-0000123 and partial prefixes of it. Anything else is a person. */
function isOrderNumber(term: string): boolean {
  return /^[A-Za-z]{2,6}-?\d/.test(term.trim());
}
