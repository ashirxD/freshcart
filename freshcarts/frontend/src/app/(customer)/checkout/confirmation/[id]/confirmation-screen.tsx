'use client';

import Link from 'next/link';
import { CheckCircle2, MapPin, Phone, Store, Truck } from 'lucide-react';
import { formatDistance } from '@/components/checkout/order-summary-panel';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrder } from '@/features/orders/orders.hooks';
import { formatPkr, formatPkrLabel } from '@/lib/format';

/**
 * Order placed.
 *
 * The one thing this screen must get right is the order number: it is what the
 * shopper writes down, quotes on the phone and searches for later. So it is the
 * largest, most copyable thing on the page.
 *
 * WHAT IS NOT HERE
 * A delivery time. The routing provider gives a travel duration, not a
 * fulfilment estimate — it knows nothing about how long the store takes to pick
 * an order — so promising "arrives in 25 minutes" would be a number made up on
 * the client. The honest next step is shown instead: what happens now, and
 * where to watch it happen (§44).
 */
export function ConfirmationScreen({ orderId }: { orderId: string }) {
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  if (isPending) {
    return (
      <Container className="flex flex-col items-center gap-gutter py-lg">
        <Skeleton className="h-16 w-16 rounded-full" label="Confirming your order" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full max-w-md" />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-lg">
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We could not load your confirmation"
        />
        <p className="mt-gutter text-center text-sm text-text-muted">
          Your order may still have been placed — check{' '}
          <Link href="/orders" className="font-medium text-primary underline">
            your orders
          </Link>{' '}
          before trying again.
        </p>
      </Container>
    );
  }

  const isDelivery = order.fulfillmentMethod === 'DELIVERY';

  return (
    <Container className="flex flex-col items-center gap-lg py-lg">
      {/*
        `status` rather than `alert`: this is a successful outcome, and an alert
        role would announce it with an urgency that does not fit.
      */}
      <div role="status" className="flex flex-col items-center gap-gutter text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-9" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-1">
          <h1 id="main-content" className="text-2xl font-bold text-text">
            Order placed
          </h1>
          <p className="text-text-muted">
            Thank you. {isDelivery ? 'We will bring it to you.' : 'We will have it ready for you.'}
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-gutter rounded-lg border border-outline-variant bg-surface p-lg shadow-card">
        <div className="flex flex-col items-center gap-1 border-b border-outline-variant pb-gutter text-center">
          <span className="text-sm text-text-muted">Your order number</span>
          {/* Selectable and tabular: a shopper copies this or reads it aloud. */}
          <span className="text-2xl font-bold tracking-wide tabular-nums text-primary select-all">
            {order.orderNumber}
          </span>
        </div>

        <dl className="flex flex-col gap-xs text-sm">
          <div className="flex items-center justify-between gap-gutter">
            <dt className="text-text-muted">Total</dt>
            <dd
              className="text-lg font-bold tabular-nums text-text"
              aria-label={'Total ' + formatPkrLabel(order.pricing.total)}
            >
              {formatPkr(order.pricing.total)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-gutter">
            <dt className="text-text-muted">Paying with</dt>
            <dd className="text-text">
              {order.payment.method === 'CASH_ON_DELIVERY'
                ? isDelivery
                  ? 'Cash on delivery'
                  : 'Cash on collection'
                : order.payment.method}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-gutter">
            <dt className="flex items-center gap-1.5 text-text-muted">
              {isDelivery ? (
                <Truck className="size-4" aria-hidden="true" />
              ) : (
                <Store className="size-4" aria-hidden="true" />
              )}
              {isDelivery ? 'Delivering to' : 'Collect from'}
            </dt>
            <dd className="max-w-[60%] text-end text-text">
              {isDelivery
                ? (order.deliveryAddress?.formatted ?? '—')
                : (order.pickup?.storeName ?? '—')}
            </dd>
          </div>

          {isDelivery && order.delivery ? (
            <div className="flex items-center justify-between gap-gutter">
              <dt className="text-text-muted">Distance</dt>
              <dd className="text-text">{formatDistance(order.delivery.distanceMeters)}</dd>
            </div>
          ) : null}
        </dl>

        {/* The next step, stated as fact rather than as a promised time. */}
        <p className="rounded-md bg-surface-muted p-gutter text-sm text-text-muted">
          {isDelivery
            ? 'The store will confirm your order shortly and start preparing it. You can follow every step on the tracking page.'
            : 'The store will confirm your order and let you know when it is ready to collect. Bring your order number with you.'}
        </p>

        {!isDelivery && order.pickup ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="flex items-start gap-1.5 text-text-muted">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {order.pickup.storeAddress}
            </p>
            <a
              href={'tel:' + order.pickup.storePhone}
              className="flex min-h-11 items-center gap-1.5 text-primary"
            >
              <Phone className="size-4" aria-hidden="true" />
              {order.pickup.storePhone}
            </a>
          </div>
        ) : null}
      </div>

      <div className="flex w-full max-w-md flex-col gap-xs sm:flex-row">
        <ButtonLink href={'/orders/' + order.id} fullWidth size="lg">
          Track order
        </ButtonLink>
        <ButtonLink href="/categories" variant="outline" fullWidth size="lg">
          Continue shopping
        </ButtonLink>
      </div>
    </Container>
  );
}
