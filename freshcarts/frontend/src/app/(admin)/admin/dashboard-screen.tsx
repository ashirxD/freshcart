'use client';

import Link from 'next/link';
import { AlertTriangle, PauseCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { ErrorState } from '@/components/common/error-state';
import { StatTile } from '@/components/store-manager/stat-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminDashboard } from '@/features/admin/admin.hooks';
import { formatPkr } from '@/lib/format';

/**
 * THE CONTROL CENTRE
 *
 * One request, and every tile on it is a link to the list the number came from
 * — a count nobody can act on is decoration. Section 4 rules out invented
 * metrics, so there is no conversion rate, no trend arrow and no projection
 * here: every figure is a count or a sum the database already holds.
 */
export function AdminDashboardScreen() {
  const { data, isPending, isError, error, refetch } = useAdminDashboard();

  if (isPending) {
    return (
      <>
        <AdminPageHeader title="Dashboard" description="Loading today's numbers…" />
        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-24 w-full"
              label={index === 0 ? 'Loading dashboard' : undefined}
            />
          ))}
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <AdminPageHeader title="Dashboard" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </>
    );
  }

  const { orders, catalogue, inventory, people, stores, platform } = data;

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={
          stores.open > 0
            ? stores.open + ' of ' + stores.active + ' active stores are open right now'
            : 'No store is inside its opening hours right now'
        }
      />

      {!platform.orderingEnabled ? (
        // A platform-wide pause is the single most consequential state the
        // system can be in, so it is stated at the top rather than left to be
        // noticed on the settings page.
        <p
          role="status"
          className="gap-gutter border-secondary/40 bg-secondary-container/20 text-secondary p-gutter mb-lg flex items-center rounded-lg border text-sm font-semibold"
        >
          <PauseCircle className="size-5 shrink-0" aria-hidden="true" />
          <span>
            Ordering is paused platform-wide. No customer can place an order.{' '}
            <Link href="/admin/settings" className="underline">
              Change this in settings
            </Link>
          </span>
        </p>
      ) : null}

      <section aria-labelledby="today-heading" className="mb-lg">
        <h2 id="today-heading" className="text-text mb-gutter text-base font-semibold">
          Today
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile label="Orders today" value={orders.ordersToday} href="/admin/orders" />

          {/* Rendered as a tile with a formatted value rather than a raw count,
              because rupees and quantities must never be read as the same unit. */}
          <MoneyTile label="Revenue today" amount={orders.revenueToday} />

          <StatTile
            label="Waiting on the store"
            value={orders.needsAction}
            href="/admin/orders?needsAction=true"
            tone={orders.needsAction > 0 ? 'ATTENTION' : 'DEFAULT'}
          />

          <StatTile
            label="New orders"
            value={orders.pending}
            href="/admin/orders?status=PENDING"
            tone={orders.pending > 0 ? 'ATTENTION' : 'DEFAULT'}
          />
        </div>
      </section>

      <section aria-labelledby="week-heading" className="mb-lg">
        <h2 id="week-heading" className="text-text mb-gutter text-base font-semibold">
          Last seven days
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile label="Orders" value={orders.ordersThisWeek} href="/admin/orders" />
          <MoneyTile label="Revenue" amount={orders.revenueThisWeek} />
          <StatTile
            label="Out for delivery"
            value={orders.outForDelivery}
            href="/admin/orders?status=OUT_FOR_DELIVERY"
          />
          <StatTile
            label="Ready for pickup"
            value={orders.readyForPickup}
            href="/admin/orders?status=READY_FOR_PICKUP"
          />
        </div>

        <p className="text-text-muted mt-xs text-xs">
          Revenue counts orders that were placed and not cancelled, rejected or failed, at the
          totals they were charged.
        </p>
      </section>

      <section aria-labelledby="catalogue-heading" className="mb-lg">
        <h2 id="catalogue-heading" className="text-text mb-gutter text-base font-semibold">
          Catalogue and stock
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile
            label="Products on sale"
            value={catalogue.activeProducts}
            href="/admin/products"
          />
          <StatTile label="Categories" value={catalogue.categories} href="/admin/categories" />
          <StatTile
            label="Running low"
            value={inventory.lowStock}
            href="/admin/inventory?status=LOW_STOCK"
            tone={inventory.lowStock > 0 ? 'WARNING' : 'DEFAULT'}
          />
          <StatTile
            label="Out of stock"
            value={inventory.outOfStock}
            href="/admin/inventory?status=OUT_OF_STOCK"
            tone={inventory.outOfStock > 0 ? 'DANGER' : 'DEFAULT'}
          />
        </div>
      </section>

      <section aria-labelledby="people-heading">
        <h2 id="people-heading" className="text-text mb-gutter text-base font-semibold">
          People and stores
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile label="Customers" value={people.customers} href="/admin/customers" />
          <StatTile
            label="Active customers"
            value={people.activeCustomers}
            href="/admin/customers?isActive=true"
          />
          <StatTile
            label="Store managers"
            value={people.storeManagers}
            href="/admin/store-managers"
          />
          <StatTile label="Stores" value={stores.total} href="/admin/stores" />
        </div>

        {catalogue.inactiveProducts > 0 ? (
          <p className="text-text-muted mt-gutter flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {catalogue.inactiveProducts} product
            {catalogue.inactiveProducts === 1 ? ' is' : 's are'} hidden from shoppers.{' '}
            <Link href="/admin/products" className="text-primary underline">
              Review
            </Link>
          </p>
        ) : null}
      </section>
    </>
  );
}

/**
 * A money figure, deliberately not a StatTile.
 *
 * StatTile takes a `number` and renders it as a plain count. Passing rupees to
 * it would show "5600" beside "4 orders" in identical type, which invites the
 * two to be read as the same kind of quantity.
 */
function MoneyTile({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="gap-xs border-outline-variant bg-surface p-gutter flex min-h-24 flex-col rounded-lg border">
      <span className="text-text text-2xl leading-none font-bold tabular-nums">
        {formatPkr(amount)}
      </span>
      <span className="text-text text-sm leading-snug font-medium">{label}</span>
    </div>
  );
}
