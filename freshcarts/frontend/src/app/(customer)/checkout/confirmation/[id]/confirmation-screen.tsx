'use client';

import Link from 'next/link';
import { Check, MapPin, Phone, Store, Truck } from 'lucide-react';
import { formatDistance } from '@/components/checkout/order-summary-panel';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrder } from '@/features/orders/orders.hooks';
import { Ltr, Money } from '@/components/common/ltr';
import { useI18n, type TranslationKey } from '@/i18n';
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
  const { t, tx } = useI18n();
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  if (isPending) {
    return (
      <Container className="gap-gutter py-wide flex flex-col items-center">
        <Skeleton className="size-20 rounded-full" label={t('checkout.confirmation.loading')} />
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
          title={t('checkout.confirmation.loadError')}
        />
        <p className="mt-gutter text-text-muted text-center text-sm">
          {tx('checkout.confirmation.maybePlaced', {
            link: (
              <Link href="/orders" className="text-primary font-semibold underline">
                {t('checkout.confirmation.yourOrdersLink')}
              </Link>
            ),
          })}
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
              {/* "On their way" would be untrue: a just-placed order has not been
                  confirmed, let alone picked. The headline says what is so. */}
              <h1 className="text-hero text-primary">{t('checkout.confirmation.title')}</h1>
              <p className="text-text-muted mx-auto max-w-md text-base">
                {isDelivery
                  ? t('checkout.confirmation.bodyDelivery')
                  : t('checkout.confirmation.bodyPickup')}
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col items-center">
        <div className="ring-outline-variant bg-surface p-gutter gap-gutter shadow-card flex w-full max-w-md flex-col rounded-2xl ring-1">
          <div className="bg-cream ring-sand flex flex-col items-center gap-1 rounded-xl py-4 text-center ring-1">
            <span className="text-eyebrow text-text-muted uppercase">
              {t('checkout.confirmation.orderNumber')}
            </span>
            {/* Selectable and tabular: a shopper copies this or reads it aloud. */}
            <span className="text-primary text-price-lg tracking-wide tabular-nums select-all">
              <Ltr>{order.orderNumber}</Ltr>
            </span>
          </div>

          <dl className="gap-snug flex flex-col text-sm">
            <div className="gap-gutter flex items-center justify-between">
              <dt className="text-text-muted">{t('common.total')}</dt>
              <dd
                className="text-text text-price tabular-nums"
                aria-label={t('checkout.summary.totalAria', {
                  amount: formatPkrLabel(order.pricing.total, t),
                })}
              >
                <Money>{formatPkr(order.pricing.total)}</Money>
              </dd>
            </div>

            <div className="gap-gutter flex items-center justify-between">
              <dt className="text-text-muted">{t('checkout.review.payingWith')}</dt>
              <dd className="text-text font-semibold">
                {order.payment.method === 'CASH_ON_DELIVERY' && !isDelivery
                  ? t('checkout.confirmation.cashOnCollection')
                  : t(('checkout.payment.method.' + order.payment.method) as TranslationKey)}
              </dd>
            </div>

            <div className="gap-gutter flex items-start justify-between">
              <dt className="text-text-muted flex items-center gap-1.5">
                {isDelivery ? (
                  <Truck className="text-leaf size-4" aria-hidden="true" />
                ) : (
                  <Store className="text-leaf size-4" aria-hidden="true" />
                )}
                {isDelivery
                  ? t('checkout.review.deliveringTo')
                  : t('checkout.confirmation.collectFrom')}
              </dt>
              <dd className="text-text max-w-[60%] text-end font-medium">
                <bdi>
                  {isDelivery
                    ? (order.deliveryAddress?.formatted ?? '—')
                    : (order.pickup?.storeName ?? '—')}
                </bdi>
              </dd>
            </div>

            {isDelivery && order.delivery ? (
              <div className="gap-gutter flex items-center justify-between">
                <dt className="text-text-muted">{t('checkout.confirmation.distance')}</dt>
                <dd className="text-text font-medium">
                  <Ltr>{formatDistance(order.delivery.distanceMeters, t)}</Ltr>
                </dd>
              </div>
            ) : null}
          </dl>

          {/* The next step, stated as fact rather than as a promised time. */}
          <p className="bg-surface-muted p-gutter text-text-muted rounded-xl text-sm leading-relaxed">
            {isDelivery
              ? t('checkout.confirmation.nextDelivery')
              : t('checkout.confirmation.nextPickup')}
          </p>

          {!isDelivery && order.pickup ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-text-muted flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <bdi>{order.pickup.storeAddress}</bdi>
              </p>
              <a
                href={'tel:' + order.pickup.storePhone}
                className="text-primary flex min-h-11 items-center gap-1.5 font-semibold"
              >
                <Phone className="size-4" aria-hidden="true" />
                <Ltr>{order.pickup.storePhone}</Ltr>
              </a>
            </div>
          ) : null}
        </div>

        <div className="gap-snug flex w-full max-w-md flex-col sm:flex-row">
          <ButtonLink href={'/orders/' + order.id} fullWidth size="lg">
            {t('checkout.confirmation.track')}
          </ButtonLink>
          <ButtonLink href="/categories" variant="outline" fullWidth size="lg">
            {t('checkout.confirmation.keepShopping')}
          </ButtonLink>
        </div>
      </Container>
    </div>
  );
}
