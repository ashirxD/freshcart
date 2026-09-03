'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Store } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { OrderActionBar } from '@/components/store-manager/order-action-bar';
import { PickingList } from '@/components/store-manager/picking-list';
import { SubstitutionDialog } from '@/components/store-manager/substitution-dialog';
import { FulfillmentBadge } from '@/components/store-manager/store-order-row';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCancelSubstitution, useStoreOrder } from '@/features/store-manager/store-manager.hooks';
import { ApiError } from '@/lib/api/errors';
import { formatPkr } from '@/lib/format';
import type { StoreOrderDetail, StoreOrderItem } from '@/types/store-manager';

/** The states in which an order's lines may still be swapped, per the API. */
const EDITABLE_STATUSES = ['CONFIRMED', 'PREPARING'];

/**
 * The order fulfilment screen.
 *
 * Everything a picker, a packer and whoever hands the bag over needs, in the
 * order they need it: what to do next, what to put in the bag, where it is
 * going, and what happened so far.
 */
export function OrderDetailScreen({ id }: { id: string }) {
  const [substituting, setSubstituting] = useState<StoreOrderItem | null>(null);
  const { data: order, isPending, isError, error, refetch } = useStoreOrder(id);

  if (isPending) {
    return (
      <Container className="gap-loose flex flex-col">
        <Skeleton className="h-7 w-56" label="Loading the order" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </Container>
    );
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404;

    return (
      <Container>
        {missing ? (
          <EmptyState
            icon={<Store className="size-7" aria-hidden="true" />}
            title="Order not found"
            description="This order does not belong to your store, or it no longer exists."
            action={<ButtonLink href="/store-manager/orders">Back to orders</ButtonLink>}
            className="bg-surface-muted rounded-lg"
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </Container>
    );
  }

  const canSubstitute = EDITABLE_STATUSES.includes(order.status);

  return (
    <Container className="gap-loose flex flex-col">
      <Link
        href="/store-manager/orders"
        className="text-text-muted hover:text-text inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        All orders
      </Link>

      <header className="gap-gutter flex flex-wrap items-start justify-between">
        <div className="gap-tight flex flex-col">
          <h1 className="text-text text-xl font-semibold tabular-nums">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} label={order.statusLabel} />
            <FulfillmentBadge method={order.fulfillmentMethod} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        <p className="text-text text-xl font-bold tabular-nums">{formatPkr(order.total)}</p>
      </header>

      {/* What to do next, at the top where it cannot be missed (§45). */}
      <section
        className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
        aria-labelledby="actions-heading"
      >
        <h2 id="actions-heading" className="text-text text-base font-semibold">
          Next step
        </h2>
        <OrderActionBar order={order} />
      </section>

      {order.cancellation ? (
        <p className="bg-danger/5 text-danger p-gutter rounded-lg text-sm">
          <span className="font-semibold">
            {order.statusLabel} on{' '}
            {new Date(order.cancellation.cancelledAt).toLocaleString('en-PK')}
          </span>
          {order.cancellation.reason ? ' — ' + order.cancellation.reason : ''}
        </p>
      ) : null}

      <div className="gap-loose flex flex-col lg:flex-row lg:items-start">
        <div className="gap-loose flex min-w-0 flex-1 flex-col">
          <PickingList order={order} onSubstitute={canSubstitute ? setSubstituting : undefined} />

          <SubstitutionHistory order={order} />
        </div>

        <aside className="gap-loose flex w-full flex-col lg:w-80 lg:shrink-0">
          <FulfillmentPanel order={order} />
          <PricingPanel order={order} />
          <HistoryPanel order={order} />
        </aside>
      </div>

      <SubstitutionDialog
        orderId={order.id}
        item={substituting}
        onClose={() => setSubstituting(null)}
      />
    </Container>
  );
}

/**
 * Where the order is going, and who to call.
 *
 * Exactly the fields fulfilment needs (§24). The coordinates become a map link
 * rather than an embedded map — §25 allows handing them to a navigation app and
 * explicitly rules out building one.
 */
function FulfillmentPanel({ order }: { order: StoreOrderDetail }) {
  const address = order.deliveryAddress;

  return (
    <section
      className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
      aria-labelledby="fulfilment-heading"
    >
      <h2 id="fulfilment-heading" className="text-text text-base font-semibold">
        {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}
      </h2>

      <div className="gap-tight flex flex-col text-sm">
        <p className="text-text font-medium">{order.customer.name}</p>

        {order.customer.phone ? (
          <a
            href={'tel:' + order.customer.phone}
            className="text-primary min-h-touch inline-flex items-center gap-1.5 font-medium"
          >
            <Phone className="size-4" aria-hidden="true" />
            {order.customer.phone}
          </a>
        ) : null}
      </div>

      {address ? (
        <div className="gap-tight flex flex-col text-sm">
          <p className="text-text">{address.formatted}</p>
          {address.landmark ? (
            <p className="text-text-muted">Landmark: {address.landmark}</p>
          ) : null}
          {address.deliveryInstructions ? (
            <p className="bg-secondary-container/20 text-text rounded-md px-2 py-1">
              {address.deliveryInstructions}
            </p>
          ) : null}

          {order.delivery ? (
            <p className="text-text-muted">
              {(order.delivery.distanceMeters / 1000).toFixed(1)} km ·{' '}
              {formatPkr(order.delivery.fee)} delivery fee
            </p>
          ) : null}

          <a
            href={
              'https://www.google.com/maps/search/?api=1&query=' +
              address.latitude +
              ',' +
              address.longitude
            }
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary min-h-touch inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Open in maps
          </a>
        </div>
      ) : order.pickup ? (
        <div className="gap-tight flex flex-col text-sm">
          <p className="text-text font-medium">{order.pickup.storeName}</p>
          <p className="text-text-muted">{order.pickup.storeAddress}</p>
          {order.pickup.instructions ? (
            <p className="text-text-muted">{order.pickup.instructions}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PricingPanel({ order }: { order: StoreOrderDetail }) {
  return (
    <section
      className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
      aria-labelledby="pricing-heading"
    >
      <h2 id="pricing-heading" className="text-text text-base font-semibold">
        Payment
      </h2>

      <dl className="gap-tight flex flex-col text-sm">
        <Row label="Subtotal" value={formatPkr(order.pricing.subtotal)} />
        {order.pricing.deliveryFee > 0 ? (
          <Row label="Delivery" value={formatPkr(order.pricing.deliveryFee)} />
        ) : null}
        <Row label="Total" value={formatPkr(order.pricing.total)} emphasis />
        <Row
          label="Method"
          value={
            order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : order.paymentMethod
          }
        />
      </dl>
    </section>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-text-muted">{label}</dt>
      <dd className={emphasis ? 'text-text font-bold tabular-nums' : 'text-text tabular-nums'}>
        {value}
      </dd>
    </div>
  );
}

/** The audit trail, including who acted — which the customer's view withholds. */
function HistoryPanel({ order }: { order: StoreOrderDetail }) {
  return (
    <section
      className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
      aria-labelledby="history-heading"
    >
      <h2 id="history-heading" className="text-text text-base font-semibold">
        History
      </h2>

      <ol className="gap-gutter flex list-none flex-col">
        {order.statusHistory.map((entry, index) => (
          <li key={index} className="flex flex-col gap-0.5 text-sm">
            <span className="text-text font-medium">{entry.statusLabel}</span>
            <span className="text-text-muted text-xs">
              <time dateTime={entry.changedAt}>
                {new Date(entry.changedAt).toLocaleString('en-PK')}
              </time>
              {' · '}
              {entry.changedByRole === 'CUSTOMER'
                ? 'Customer'
                : entry.changedByRole === 'STORE_MANAGER'
                  ? 'Store'
                  : entry.changedByRole === 'SYSTEM'
                    ? 'System'
                    : entry.changedByRole}
            </span>
            <span className="text-text-muted">{entry.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Replacements proposed on this order, and their outcome. */
function SubstitutionHistory({ order }: { order: StoreOrderDetail }) {
  const cancel = useCancelSubstitution();

  if (order.substitutions.length === 0) return null;

  return (
    <section className="gap-gutter flex flex-col" aria-labelledby="substitutions-heading">
      <h2 id="substitutions-heading" className="text-text text-base font-semibold">
        Replacements
      </h2>

      <ul className="border-outline-variant divide-outline-variant bg-surface divide-y rounded-lg border">
        {order.substitutions.map((substitution) => (
          <li key={substitution.id} className="gap-gutter p-gutter flex flex-wrap items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <p className="text-text">
                <span className="line-through">{substitution.original.productName}</span>
                {' → '}
                <span className="font-medium">{substitution.replacement.productName}</span>
                {' (× ' + substitution.replacement.quantity + ')'}
              </p>

              <p className="text-text-muted text-xs">
                Customer pays {formatPkr(substitution.chargedLineTotal)}
                {substitution.storeAbsorbs > 0
                  ? ' · store absorbs ' + formatPkr(substitution.storeAbsorbs)
                  : ''}
              </p>

              {substitution.note ? (
                <p className="text-text-muted text-xs">{substitution.note}</p>
              ) : null}
            </div>

            <div className="gap-tight flex shrink-0 flex-col items-end">
              <span
                className={
                  substitution.status === 'ACCEPTED'
                    ? 'text-success text-xs font-semibold'
                    : substitution.status === 'PROPOSED'
                      ? 'text-secondary text-xs font-semibold'
                      : 'text-text-muted text-xs font-semibold'
                }
              >
                {substitution.status === 'PROPOSED'
                  ? 'Waiting for customer'
                  : substitution.status === 'ACCEPTED'
                    ? 'Accepted'
                    : substitution.status === 'REJECTED'
                      ? 'Declined'
                      : 'Withdrawn'}
              </span>

              {substitution.status === 'PROPOSED' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={cancel.isPending}
                  onClick={() => cancel.mutate(substitution.id)}
                >
                  Withdraw
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
