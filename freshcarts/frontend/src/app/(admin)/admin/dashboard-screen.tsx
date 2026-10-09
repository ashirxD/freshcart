'use client';

import Link from 'next/link';
import { AlertTriangle, PauseCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { ErrorState } from '@/components/common/error-state';
import { Money } from '@/components/common/ltr';
import { StatTile } from '@/components/store-manager/stat-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminDashboard } from '@/features/admin/admin.hooks';
import { useT } from '@/i18n';
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
  const t = useT();
  const { data, isPending, isError, error, refetch } = useAdminDashboard();

  if (isPending) {
    return (
      <>
        <AdminPageHeader
          title={t('admin.nav.dashboard')}
          description={t('admin.dashboard.loadingDesc')}
        />
        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-24 w-full"
              label={index === 0 ? t('admin.dashboard.loadingLabel') : undefined}
            />
          ))}
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <AdminPageHeader title={t('admin.nav.dashboard')} />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </>
    );
  }

  const { orders, catalogue, inventory, people, stores, platform } = data;

  return (
    <>
      <AdminPageHeader
        title={t('admin.nav.dashboard')}
        description={
          stores.open > 0
            ? t('admin.dashboard.storesOpen', { open: stores.open, active: stores.active })
            : t('admin.dashboard.noStoreOpen')
        }
      />

      {!platform.orderingEnabled ? (
        // A platform-wide pause is the single most consequential state the
        // system can be in, so it is stated at the top rather than left to be
        // noticed on the settings page.
        <p
          role="status"
          className="gap-gutter ring-apricot/50 bg-apricot/15 text-attention p-gutter mb-loose flex items-center rounded-2xl text-sm font-semibold ring-1"
        >
          <PauseCircle className="size-5 shrink-0" aria-hidden="true" />
          <span>
            {t('admin.dashboard.paused')}{' '}
            <Link href="/admin/settings" className="underline">
              {t('admin.dashboard.changeInSettings')}
            </Link>
          </span>
        </p>
      ) : null}

      <section aria-labelledby="today-heading" className="mb-loose">
        <h2 id="today-heading" className="text-text mb-gutter text-base font-semibold">
          {t('admin.dashboard.today')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile label={t('admin.dashboard.ordersToday')} value={orders.ordersToday} href="/admin/orders" />

          {/* Rendered as a tile with a formatted value rather than a raw count,
              because rupees and quantities must never be read as the same unit. */}
          <MoneyTile label={t('admin.dashboard.revenueToday')} amount={orders.revenueToday} />

          <StatTile
            label={t('admin.dashboard.waitingOnStore')}
            value={orders.needsAction}
            href="/admin/orders?needsAction=true"
            tone={orders.needsAction > 0 ? 'ATTENTION' : 'DEFAULT'}
          />

          <StatTile
            label={t('admin.dashboard.newOrders')}
            value={orders.pending}
            href="/admin/orders?status=PENDING"
            tone={orders.pending > 0 ? 'ATTENTION' : 'DEFAULT'}
          />
        </div>
      </section>

      <section aria-labelledby="week-heading" className="mb-loose">
        <h2 id="week-heading" className="text-text mb-gutter text-base font-semibold">
          {t('admin.dashboard.lastSeven')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile label={t('admin.dashboard.orders')} value={orders.ordersThisWeek} href="/admin/orders" />
          <MoneyTile label={t('admin.dashboard.revenue')} amount={orders.revenueThisWeek} />
          <StatTile
            label={t('admin.dashboard.outForDelivery')}
            value={orders.outForDelivery}
            href="/admin/orders?status=OUT_FOR_DELIVERY"
          />
          <StatTile
            label={t('admin.dashboard.readyForPickup')}
            value={orders.readyForPickup}
            href="/admin/orders?status=READY_FOR_PICKUP"
          />
        </div>

        <p className="text-text-muted mt-tight text-xs">
          {t('admin.dashboard.revenueNote')}
        </p>
      </section>

      <section aria-labelledby="catalogue-heading" className="mb-loose">
        <h2 id="catalogue-heading" className="text-text mb-gutter text-base font-semibold">
          {t('admin.dashboard.catalogueStock')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile
            label={t('admin.dashboard.productsOnSale')}
            value={catalogue.activeProducts}
            href="/admin/products"
          />
          <StatTile
            label={t('admin.dashboard.categories')}
            value={catalogue.categories}
            href="/admin/categories"
          />
          <StatTile
            label={t('admin.dashboard.runningLow')}
            value={inventory.lowStock}
            href="/admin/inventory?status=LOW_STOCK"
            tone={inventory.lowStock > 0 ? 'WARNING' : 'DEFAULT'}
          />
          <StatTile
            label={t('admin.dashboard.outOfStock')}
            value={inventory.outOfStock}
            href="/admin/inventory?status=OUT_OF_STOCK"
            tone={inventory.outOfStock > 0 ? 'DANGER' : 'DEFAULT'}
          />
        </div>
      </section>

      <section aria-labelledby="people-heading">
        <h2 id="people-heading" className="text-text mb-gutter text-base font-semibold">
          {t('admin.dashboard.peopleStores')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
          <StatTile
            label={t('admin.dashboard.customers')}
            value={people.customers}
            href="/admin/customers"
          />
          <StatTile
            label={t('admin.dashboard.activeCustomers')}
            value={people.activeCustomers}
            href="/admin/customers?isActive=true"
          />
          <StatTile
            label={t('admin.dashboard.storeManagers')}
            value={people.storeManagers}
            href="/admin/store-managers"
          />
          <StatTile label={t('admin.dashboard.stores')} value={stores.total} href="/admin/stores" />
        </div>

        {catalogue.inactiveProducts > 0 ? (
          <p className="text-text-muted mt-gutter flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('admin.dashboard.hiddenProducts', { count: catalogue.inactiveProducts })}{' '}
            <Link href="/admin/products" className="text-primary underline">
              {t('admin.dashboard.review')}
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
    <div className="gap-tight ring-outline-variant bg-surface p-gutter shadow-card flex min-h-24 flex-col rounded-2xl ring-1">
      <span className="text-text text-2xl leading-none font-bold tabular-nums">
        <Money>{formatPkr(amount)}</Money>
      </span>
      <span className="text-text text-sm leading-snug font-medium">{label}</span>
    </div>
  );
}
