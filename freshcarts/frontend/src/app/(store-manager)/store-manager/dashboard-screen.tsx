'use client';

import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { StatTile } from '@/components/store-manager/stat-tile';
import { StoreOrderRow } from '@/components/store-manager/store-order-row';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreDashboard, useStoreOrders } from '@/features/store-manager/store-manager.hooks';
import { useI18n } from '@/i18n';

/**
 * The operations dashboard.
 *
 * Ordered by §5's priority and nothing else: what needs action, then inventory
 * alerts, then the day's throughput. No charts — this screen exists to be
 * glanced at between customers, and a chart answers a question nobody standing
 * at a counter is asking.
 */
export function DashboardScreen() {
  const { t, tx } = useI18n();
  const dashboard = useStoreDashboard();

  // The same "needs action" definition the tiles count, so the list under them
  // is exactly the orders those numbers refer to.
  const queue = useStoreOrders({ needsAction: true, limit: 8 });

  if (dashboard.isPending) {
    return (
      <Container className="gap-loose flex flex-col">
        <Skeleton className="h-7 w-48" label={t('store.dashboard.loading')} />
        <div className="gap-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </Container>
    );
  }

  if (dashboard.isError) {
    return (
      <Container>
        <ErrorState
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
          title={t('store.dashboard.loadFailed')}
        />
      </Container>
    );
  }

  const { orders, inventory, substitutions } = dashboard.data;

  return (
    <Container className="gap-loose flex flex-col">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-text text-xl font-semibold">
          {tx('store.dashboard.today', { store: <bdi>{dashboard.data.store.name}</bdi> })}
        </h1>
        <p className="text-text-muted text-sm">
          {orders.needsAction === 0
            ? t('store.dashboard.nothingWaiting')
            : t('store.dashboard.attention', { count: orders.needsAction })}
        </p>
      </header>

      {/* 1. Orders requiring action — the most important thing on the screen. */}
      <section className="gap-gutter flex flex-col" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="text-text text-base font-semibold">
          {t('store.dashboard.ordersNeedingAttention')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 sm:grid-cols-4">
          <StatTile
            label={t('store.dashboard.pending')}
            value={orders.pending}
            tone={orders.pending > 0 ? 'ATTENTION' : 'DEFAULT'}
            href="/store-manager/orders?status=PENDING"
          />
          <StatTile
            label={t('store.dashboard.confirmed')}
            value={orders.confirmed}
            href="/store-manager/orders?status=CONFIRMED"
          />
          <StatTile
            label={t('store.dashboard.preparing')}
            value={orders.preparing}
            href="/store-manager/orders?status=PREPARING"
          />
          <StatTile
            label={t('store.dashboard.packed')}
            value={orders.packed}
            tone={orders.packed > 0 ? 'ATTENTION' : 'DEFAULT'}
            href="/store-manager/orders?status=PACKED"
          />
        </div>
      </section>

      <section className="gap-gutter flex flex-col" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-text text-base font-semibold">
          {t('store.dashboard.onTheWay')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 sm:grid-cols-3">
          <StatTile
            label={t('store.dashboard.readyForPickup')}
            value={orders.readyForPickup}
            href="/store-manager/orders?status=READY_FOR_PICKUP"
          />
          <StatTile
            label={t('store.dashboard.outForDelivery')}
            value={orders.outForDelivery}
            href="/store-manager/orders?status=OUT_FOR_DELIVERY"
          />
          <StatTile
            label={t('store.dashboard.completedToday')}
            value={orders.completedToday}
            href="/store-manager/orders?status=DELIVERED"
          />
        </div>
      </section>

      {/* 2. Inventory alerts. */}
      <section className="gap-gutter flex flex-col" aria-labelledby="inventory-heading">
        <h2 id="inventory-heading" className="text-text text-base font-semibold">
          {t('store.dashboard.inventoryAlerts')}
        </h2>

        <div className="gap-gutter grid grid-cols-2 sm:grid-cols-3">
          <StatTile
            label={t('store.dashboard.lowStock')}
            value={inventory.lowStock}
            tone={inventory.lowStock > 0 ? 'WARNING' : 'DEFAULT'}
            href="/store-manager/inventory?status=LOW_STOCK"
          />
          <StatTile
            label={t('store.dashboard.outOfStock')}
            value={inventory.outOfStock}
            tone={inventory.outOfStock > 0 ? 'DANGER' : 'DEFAULT'}
            href="/store-manager/inventory?status=OUT_OF_STOCK"
          />
          <StatTile
            label={t('store.dashboard.wellStocked')}
            value={inventory.inStock}
            href="/store-manager/inventory?status=IN_STOCK"
          />
        </div>

        {inventory.lowStock === 0 && inventory.outOfStock === 0 ? (
          <p className="text-success flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t('store.dashboard.allWellStocked')}
          </p>
        ) : null}
      </section>

      {substitutions.awaitingCustomer > 0 ? (
        <section className="gap-gutter flex flex-col" aria-labelledby="substitutions-heading">
          <h2 id="substitutions-heading" className="text-text text-base font-semibold">
            {t('store.dashboard.replacements')}
          </h2>
          <StatTile
            label={t('store.dashboard.replacementWaiting', {
              count: substitutions.awaitingCustomer,
            })}
            value={substitutions.awaitingCustomer}
            tone="WARNING"
            className="sm:max-w-xs"
          />
        </section>
      ) : null}

      {/* The list the "needs attention" numbers refer to. */}
      <section className="gap-gutter flex flex-col" aria-labelledby="queue-heading">
        <div className="gap-gutter flex flex-wrap items-center justify-between">
          <h2 id="queue-heading" className="text-text text-base font-semibold">
            {t('store.dashboard.nextUp')}
          </h2>
          <ButtonLink href="/store-manager/orders" variant="outline" size="sm">
            {t('store.dashboard.allOrders')}
          </ButtonLink>
        </div>

        {queue.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" label={t('store.dashboard.loadingOrders')} />
            ))}
          </div>
        ) : null}

        {queue.isError ? (
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
        ) : null}

        {queue.data?.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-7" aria-hidden="true" />}
            title={t('store.dashboard.noOrdersTitle')}
            description={t('store.dashboard.noOrdersBody')}
            className="bg-surface-muted rounded-2xl"
          />
        ) : null}

        {queue.data && queue.data.items.length > 0 ? (
          <ul className="flex list-none flex-col gap-2">
            {queue.data.items.map((order) => (
              <StoreOrderRow key={order.id} order={order} />
            ))}
          </ul>
        ) : null}
      </section>
    </Container>
  );
}
