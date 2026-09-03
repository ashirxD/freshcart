'use client';

import Link from 'next/link';
import { Check, MapPin, Phone, Store, Truck } from 'lucide-react';
import { formatDistance } from '@/components/checkout/order-summary-panel';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrder } from '@/features/orders/orders.hooks';
import { formatPkr, formatPkrLabel } from '@/lib/format';

/**
 * ORDER PLACED (§38)
 *
 * The one thing this screen must get right is the order number: it is what the
 * shopper writes down, quotes on the phone and searches for later. So it is the
 * largest, most copyable thing on the page, on its own tinted card.
 *
 * THE CELEBRATION
 * A tick that pops in, and one ring that expands out of it and stops. That is
 * all — §38 asks for something satisfying and rules out confetti, and this
 * screen is also where a shopper wants to read a number carefully. Both
 * animations are one-shot and both respect reduced motion.
 *
 * WHAT IS NOT HERE
 * A delivery time. The routing provider gives a travel duration, not a
 * fulfilment estimate — it knows nothing about how long the store takes to pick
 * an order — so promising "arrives in 25 minutes" would be a number made up on
 * the client. The honest next step is shown instead: what happens now, and
 * where to watch it happen.
 */
export function ConfirmationScreen({ orderId }: { orderId: string }) {
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  if (isPending) {
    return (
      <Container className="gap-gutter py-wide flex flex-col items-center">
        <Skeleton className="size-20 rounded-full" label="Confirming your order" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full max-w-md rounded-2xl" />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-wide">
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We could not load your confirmation"
        />
        <p className="mt-gutter text-text-muted text-center text-sm">
          Your order may still have been placed — check{' '}
          <Link href="/orders" className="text-primary font-semibold underline">
            your orders
          </Link>{' '}
          before trying again.
        </p>
      </Container>
    );
  }

  const isDelivery = order.fulfillmentMethod === 'DELIVERY';

  return (
    <div className="flex flex-col">
      <div className="bg-cream py-wide relative overflow-hidden">
        <Container className="gap-loose relative flex flex-col items-center">
          {/*
            `status` rather than `alert`: this is a successful outcome, and an
            alert role would announce it with an urgency that does not fit.
          */}
          <div role="status" className="gap-gutter flex flex-col items-center text-center">
            <span className="relative flex size-20 items-center justify-center">
              <span
                aria-hidden="true"
                className="motion-safe:animate-ripple bg-leaf absolute inset-0 rounded-full"
              />
              <span className="bg-leaf text-on-primary motion-safe:animate-pop relative flex size-20 items-center justify-center rounded-full">
                <Check className="size-10" strokeWidth={3} aria-hidden="true" />
              </span>
            </span>

            <div className="flex flex-col gap-2">
              <h1 className="text-hero text-primary">
                {isDelivery ? 'Your groceries are on their way' : 'Your order is being packed'}
              </h1>
              <p className="text-text-muted max-w-md text-base">
                {isDelivery
                  ? 'The shop will confirm it shortly and start picking your items.'
                  : 'The shop will let you know as soon as it is ready to collect.'}
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col items-center">
        <div className="ring-outline-variant bg-surface p-gutter gap-gutter shadow-card flex w-full max-w-md flex-col rounded-2xl ring-1">
          <div className="bg-cream ring-sand flex flex-col items-center gap-1 rounded-xl py-4 text-center ring-1">
            <span className="text-eyebrow text-text-muted uppercase">Your order number</span>
            {/* Selectable and tabular: a shopper copies this or reads it aloud. */}
            <span className="text-primary text-price-lg tracking-wide tabular-nums select-all">
              {order.orderNumber}
            </span>
          </div>

          <dl className="gap-snug flex flex-col text-sm">
            <div className="gap-gutter flex items-center justify-between">
              <dt className="text-text-muted">Total</dt>
              <dd
                className="text-text text-price tabular-nums"
                aria-label={'Total ' + formatPkrLabel(order.pricing.total)}
              >
                {formatPkr(order.pricing.total)}
              </dd>
            </div>

            <div className="gap-gutter flex items-center justify-between">
              <dt className="text-text-muted">Paying with</dt>
              <dd className="text-text font-semibold">
                {order.payment.method === 'CASH_ON_DELIVERY'
                  ? isDelivery
                    ? 'Cash on delivery'
                    : 'Cash on collection'
                  : order.payment.method}
              </dd>
            </div>

            <div className="gap-gutter flex items-start justify-between">
              <dt className="text-text-muted flex items-center gap-1.5">
                {isDelivery ? (
                  <Truck className="text-leaf size-4" aria-hidden="true" />
                ) : (
                  <Store className="text-leaf size-4" aria-hidden="true" />
                )}
                {isDelivery ? 'Delivering to' : 'Collect from'}
              </dt>
              <dd className="text-text max-w-[60%] text-end font-medium">
                {isDelivery
                  ? (order.deliveryAddress?.formatted ?? '—')
                  : (order.pickup?.storeName ?? '—')}
              </dd>
            </div>

            {isDelivery && order.delivery ? (
              <div className="gap-gutter flex items-center justify-between">
                <dt className="text-text-muted">Distance</dt>
                <dd className="text-text font-medium">
                  {formatDistance(order.delivery.distanceMeters)}
                </dd>
              </div>
            ) : null}
          </dl>

          {/* The next step, stated as fact rather than as a promised time. */}
          <p className="bg-surface-muted p-gutter text-text-muted rounded-xl text-sm leading-relaxed">
            {isDelivery
              ? 'You can follow every step on the tracking page — from confirmed, to packed, to on its way.'
              : 'Bring your order number with you. We will hold the order at the counter.'}
          </p>

          {!isDelivery && order.pickup ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-text-muted flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {order.pickup.storeAddress}
              </p>
              <a
                href={'tel:' + order.pickup.storePhone}
                className="text-primary flex min-h-11 items-center gap-1.5 font-semibold"
              >
                <Phone className="size-4" aria-hidden="true" />
                {order.pickup.storePhone}
              </a>
            </div>
          ) : null}
        </div>

        <div className="gap-snug flex w-full max-w-md flex-col sm:flex-row">
          <ButtonLink href={'/orders/' + order.id} fullWidth size="lg">
            Track this order
          </ButtonLink>
          <ButtonLink href="/categories" variant="outline" fullWidth size="lg">
            Keep shopping
          </ButtonLink>
        </div>
      </Container>
    </div>
  );
}
