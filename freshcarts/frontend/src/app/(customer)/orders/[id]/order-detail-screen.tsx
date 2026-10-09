'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Store, Truck } from 'lucide-react';
import { formatDistance, formatDuration } from '@/components/checkout/order-summary-panel';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { ProductImage } from '@/components/product/product-image';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCancelOrder, useOrder } from '@/features/orders/orders.hooks';
import { Ltr, Money } from '@/components/common/ltr';
import { useI18n, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { formatPkr, formatPkrLabel, productTint } from '@/lib/format';
import type { OrderDetail } from '@/types/order';

/**
 * A single order.
 *
 * Everything here is the order's own snapshot: item names, images, prices, the
 * address it went to, the distance measured at the time. Nothing is re-read
 * from the live catalogue, so this page reads correctly years later even if the
 * products have been renamed, repriced or withdrawn (§5, §17, §27).
 */
export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const { t, locale } = useI18n();
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  if (isPending) {
    return (
      <Container className="gap-gutter py-wide flex flex-col">
        <Skeleton className="h-9 w-48" label={t('orders.detail.loading')} />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-loose">
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title={t('orders.detail.loadError')}
        />
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="bg-cream py-loose">
        <Container className="gap-snug flex flex-col">
          <Link
            href="/orders"
            className="text-primary hover:bg-surface/70 -ms-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t('orders.detail.allOrders')}
          </Link>

          <div className="gap-gutter flex flex-wrap items-start justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow text-leaf uppercase">
                {t('orders.detail.placed', { date: formatDate(order.placedAt, locale) })}
              </p>
              <h1 className="text-display text-primary tabular-nums">
                <Ltr>{order.orderNumber}</Ltr>
              </h1>
            </div>

            <OrderStatusBadge
              status={order.status}
              label={order.statusLabel}
              fulfillmentMethod={order.fulfillmentMethod}
            />
          </div>
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col lg:flex-row lg:items-start lg:gap-8">
        <div className="gap-loose flex flex-1 flex-col">
          <TrackingSection order={order} />
          <ItemsSection order={order} />
        </div>

        <aside className="gap-loose flex w-full flex-col lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
          <FulfilmentSection order={order} />
          <PaymentSection order={order} />
          <TotalsSection order={order} />
          <CancelSection order={order} />
        </aside>
      </Container>
    </div>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  const headingId = (id ?? title.toLowerCase().replace(/\s+/g, '-')) + '-heading';

  return (
    <section
      aria-labelledby={headingId}
      className="gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1"
    >
      <h2 id={headingId} className="text-text text-base font-bold tracking-[-0.015em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TrackingSection({ order }: { order: OrderDetail }) {
  const { t, locale } = useI18n();

  return (
    <Section title={t('orders.detail.progress')} id="tracking">
      {order.cancelledAt ? (
        <p className="bg-surface-muted p-gutter text-text-muted rounded-xl text-sm">
          {order.cancellationReason
            ? t('orders.detail.cancelledOnReason', {
                date: formatDate(order.cancelledAt, locale),
                reason: order.cancellationReason,
              })
            : t('orders.detail.cancelledOn', { date: formatDate(order.cancelledAt, locale) })}
        </p>
      ) : null}

      <OrderTimeline steps={order.timeline} fulfillmentMethod={order.fulfillmentMethod} />
    </Section>
  );
}

function ItemsSection({ order }: { order: OrderDetail }) {
  const { t } = useI18n();

  return (
    <Section title={t('common.itemCount', { count: order.itemCount })} id="items">
      <ul className="divide-outline-variant flex list-none flex-col divide-y">
        {order.items.map((item) => (
          <li
            key={item.productId}
            className="gap-gutter py-gutter flex items-start first:pt-0 last:pb-0"
          >
            <div
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-xl',
                productTint(item.productName),
              )}
            >
              <ProductImage
                image={item.productImage ? { url: item.productImage, alt: item.productName } : null}
                name={item.productName}
                sizes="64px"
                className="size-full p-1"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {item.brand ? (
                <span className="text-text-muted text-[0.6875rem] font-bold tracking-[0.04em] uppercase">
                  {item.brand}
                </span>
              ) : null}
              <span className="text-text text-card">{item.productName}</span>
              <span className="text-text-muted text-xs font-medium">
                {item.unitLabel} · <Money>{formatPkr(item.unitPrice)} × {item.quantity}</Money>
              </span>
            </div>

            <span className="text-text shrink-0 text-sm font-bold tabular-nums">
              <Money>{formatPkr(item.lineTotal)}</Money>
            </span>
          </li>
        ))}
      </ul>

      {order.customerNote ? (
        <p className="bg-surface-muted p-gutter text-text-muted rounded-xl text-sm">
          <span className="text-text font-medium">{t('orders.detail.yourNote')}</span>
          <bdi>{order.customerNote}</bdi>
        </p>
      ) : null}
    </Section>
  );
}

function FulfilmentSection({ order }: { order: OrderDetail }) {
  const { t } = useI18n();

  if (order.fulfillmentMethod === 'PICKUP' && order.pickup) {
    return (
      <Section title={t('orders.detail.collectFrom')} id="pickup">
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-text flex items-center gap-1.5 font-medium">
            <Store className="size-4" aria-hidden="true" />
            <bdi>{order.pickup.storeName}</bdi>
          </p>
          <p className="text-text-muted">
            <bdi>{order.pickup.storeAddress}</bdi>
          </p>
          <a
            href={'tel:' + order.pickup.storePhone}
            className="text-primary flex min-h-11 items-center gap-1.5"
          >
            <Phone className="size-4" aria-hidden="true" />
            <Ltr>{order.pickup.storePhone}</Ltr>
          </a>
          {order.pickup.instructions ? (
            <p className="text-text-muted">
              <bdi>{order.pickup.instructions}</bdi>
            </p>
          ) : null}
        </div>
      </Section>
    );
  }

  if (!order.deliveryAddress) return null;

  return (
    <Section title={t('orders.detail.deliveringTo')} id="delivery">
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-text font-medium">
          <bdi>{order.deliveryAddress.recipientName}</bdi>
        </p>
        <p className="text-text-muted">
          <bdi>{order.deliveryAddress.formatted}</bdi>
        </p>
        <a
          href={'tel:' + order.deliveryAddress.phone}
          className="text-primary flex min-h-11 items-center gap-1.5"
        >
          <Phone className="size-4" aria-hidden="true" />
          <Ltr>{order.deliveryAddress.phone}</Ltr>
        </a>

        {order.deliveryAddress.deliveryInstructions ? (
          <p className="text-text-muted flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <bdi>{order.deliveryAddress.deliveryInstructions}</bdi>
          </p>
        ) : null}

        {order.delivery ? (
          <p className="text-text-muted flex items-center gap-1.5 pt-1">
            <Truck className="size-4" aria-hidden="true" />
            {order.delivery.durationSeconds
              ? t('orders.detail.fromStoreWithTime', {
                  distance: formatDistance(order.delivery.distanceMeters, t),
                  duration: formatDuration(order.delivery.durationSeconds, t),
                })
              : t('orders.detail.fromStore', {
                  distance: formatDistance(order.delivery.distanceMeters, t),
                })}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function PaymentSection({ order }: { order: OrderDetail }) {
  const { t, locale } = useI18n();
  const methodLabel =
    order.payment.method === 'CASH_ON_DELIVERY' && order.fulfillmentMethod === 'PICKUP'
      ? t('checkout.confirmation.cashOnCollection')
      : t(('checkout.payment.method.' + order.payment.method) as TranslationKey);

  return (
    <Section title={t('orders.detail.payment')} id="payment">
      <div className="gap-gutter flex items-center justify-between text-sm">
        <span className="text-text">{methodLabel}</span>
        <PaymentStatusBadge status={order.payment.status} />
      </div>

      {order.payment.paidAt ? (
        <p className="text-text-muted text-xs">
          {t('orders.detail.paidOn', { date: formatDate(order.payment.paidAt, locale) })}
        </p>
      ) : order.payment.status === 'PENDING' ? (
        <p className="text-text-muted text-xs">
          {order.fulfillmentMethod === 'PICKUP'
            ? t('orders.detail.payCashPickup')
            : t('orders.detail.payCashDelivery')}
        </p>
      ) : null}
    </Section>
  );
}

function TotalsSection({ order }: { order: OrderDetail }) {
  const { t } = useI18n();

  return (
    <Section title={t('orders.detail.paymentSummary')} id="totals">
      <dl className="gap-tight flex flex-col text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">{t('common.subtotal')}</dt>
          <dd className="text-text font-semibold tabular-nums">
            <Money>{formatPkr(order.pricing.subtotal)}</Money>
          </dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            {order.fulfillmentMethod === 'DELIVERY'
              ? t('orders.detail.deliveryCharge')
              : t('checkout.summary.pickup')}
          </dt>
          <dd className="text-text font-semibold tabular-nums">
            {order.fulfillmentMethod === 'DELIVERY' ? (
              <Money>{formatPkr(order.pricing.deliveryFee)}</Money>
            ) : (
              t('checkout.summary.noCharge')
            )}
          </dd>
        </div>

        {order.pricing.discount > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">{t('checkout.summary.discount')}</dt>
            <dd className="text-success font-semibold tabular-nums">
              <Money>−{formatPkr(order.pricing.discount)}</Money>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="bg-cream ring-sand flex items-baseline justify-between rounded-xl px-3 py-2.5 ring-1">
        <span className="text-text text-sm font-bold">{t('common.total')}</span>
        <span
          className="text-primary text-price tabular-nums"
          aria-label={t('checkout.summary.totalAria', {
            amount: formatPkrLabel(order.pricing.total, t),
          })}
        >
          <Money>{formatPkr(order.pricing.total)}</Money>
        </span>
      </div>
    </Section>
  );
}

/** Cancellation, shown only while the server says it is allowed. */
function CancelSection({ order }: { order: OrderDetail }) {
  const { t } = useI18n();
  const [isConfirming, setIsConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const cancelOrder = useCancelOrder();

  // `canCancel` is the server's decision, computed from the same rule the API
  // enforces. The button is never shown for an order the API would refuse.
  if (!order.canCancel) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setIsConfirming(true)} fullWidth>
        {t('orders.detail.cancelThis')}
      </Button>

      <Modal
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        title={t('orders.detail.cancelTitle')}
        description={t('orders.detail.cancelBody', { number: order.orderNumber })}
        footer={
          <div className="gap-tight flex flex-col-reverse sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsConfirming(false)}>
              {t('orders.detail.keepMyOrder')}
            </Button>
            <Button
              variant="danger"
              isLoading={cancelOrder.isPending}
              onClick={() =>
                cancelOrder.mutate(
                  { id: order.id, reason: reason.trim() || undefined },
                  { onSuccess: () => setIsConfirming(false) },
                )
              }
            >
              {t('orders.detail.yesCancel')}
            </Button>
          </div>
        }
      >
        <Textarea
          label={t('orders.detail.whyCancel')}
          hint={t('orders.detail.whyHint')}
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
