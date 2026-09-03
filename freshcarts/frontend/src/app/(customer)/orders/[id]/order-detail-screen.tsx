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
import { cn } from '@/lib/cn';
import { formatPkr, formatPkrLabel, productTint } from '@/lib/format';
import type { OrderDetail } from '@/types/order';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * A single order.
 *
 * Everything here is the order's own snapshot: item names, images, prices, the
 * address it went to, the distance measured at the time. Nothing is re-read
 * from the live catalogue, so this page reads correctly years later even if the
 * products have been renamed, repriced or withdrawn (§5, §17, §27).
 */
export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  if (isPending) {
    return (
      <Container className="gap-gutter py-wide flex flex-col">
        <Skeleton className="h-9 w-48" label="Loading your order" />
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
          title="We could not open this order"
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
            All orders
          </Link>

          <div className="gap-gutter flex flex-wrap items-start justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow text-leaf uppercase">
                Placed {formatDateTime(order.placedAt)}
              </p>
              <h1 className="text-display text-primary tabular-nums">{order.orderNumber}</h1>
            </div>

            <OrderStatusBadge status={order.status} label={order.statusLabel} />
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
  return (
    <Section title="Order progress" id="tracking">
      {order.cancelledAt ? (
        <p className="bg-surface-muted p-gutter text-text-muted rounded-xl text-sm">
          Cancelled on {formatDateTime(order.cancelledAt)}
          {order.cancellationReason ? ' — ' + order.cancellationReason : '.'}
        </p>
      ) : null}

      <OrderTimeline steps={order.timeline} />
    </Section>
  );
}

function ItemsSection({ order }: { order: OrderDetail }) {
  return (
    <Section title={order.itemCount === 1 ? '1 item' : order.itemCount + ' items'} id="items">
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
                {item.unitLabel} · {formatPkr(item.unitPrice)} × {item.quantity}
              </span>
            </div>

            <span className="text-text shrink-0 text-sm font-bold tabular-nums">
              {formatPkr(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      {order.customerNote ? (
        <p className="bg-surface-muted p-gutter text-text-muted rounded-xl text-sm">
          <span className="text-text font-medium">Your note: </span>
          {order.customerNote}
        </p>
      ) : null}
    </Section>
  );
}

function FulfilmentSection({ order }: { order: OrderDetail }) {
  if (order.fulfillmentMethod === 'PICKUP' && order.pickup) {
    return (
      <Section title="Collect from" id="pickup">
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-text flex items-center gap-1.5 font-medium">
            <Store className="size-4" aria-hidden="true" />
            {order.pickup.storeName}
          </p>
          <p className="text-text-muted">{order.pickup.storeAddress}</p>
          <a
            href={'tel:' + order.pickup.storePhone}
            className="text-primary flex min-h-11 items-center gap-1.5"
          >
            <Phone className="size-4" aria-hidden="true" />
            {order.pickup.storePhone}
          </a>
          {order.pickup.instructions ? (
            <p className="text-text-muted">{order.pickup.instructions}</p>
          ) : null}
        </div>
      </Section>
    );
  }

  if (!order.deliveryAddress) return null;

  return (
    <Section title="Delivering to" id="delivery">
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-text font-medium">{order.deliveryAddress.recipientName}</p>
        <p className="text-text-muted">{order.deliveryAddress.formatted}</p>
        <a
          href={'tel:' + order.deliveryAddress.phone}
          className="text-primary flex min-h-11 items-center gap-1.5"
        >
          <Phone className="size-4" aria-hidden="true" />
          {order.deliveryAddress.phone}
        </a>

        {order.deliveryAddress.deliveryInstructions ? (
          <p className="text-text-muted flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {order.deliveryAddress.deliveryInstructions}
          </p>
        ) : null}

        {order.delivery ? (
          <p className="text-text-muted flex items-center gap-1.5 pt-1">
            <Truck className="size-4" aria-hidden="true" />
            {formatDistance(order.delivery.distanceMeters)} from the store
            {order.delivery.durationSeconds
              ? ' · ' + formatDuration(order.delivery.durationSeconds)
              : ''}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function PaymentSection({ order }: { order: OrderDetail }) {
  const methodLabel =
    order.payment.method === 'CASH_ON_DELIVERY'
      ? order.fulfillmentMethod === 'PICKUP'
        ? 'Cash on collection'
        : 'Cash on delivery'
      : order.payment.method === 'CARD'
        ? 'Card'
        : 'Mobile wallet';

  return (
    <Section title="Payment" id="payment">
      <div className="gap-gutter flex items-center justify-between text-sm">
        <span className="text-text">{methodLabel}</span>
        <PaymentStatusBadge status={order.payment.status} />
      </div>

      {order.payment.paidAt ? (
        <p className="text-text-muted text-xs">Paid on {formatDateTime(order.payment.paidAt)}</p>
      ) : order.payment.status === 'PENDING' ? (
        <p className="text-text-muted text-xs">
          {order.fulfillmentMethod === 'PICKUP'
            ? 'Please pay in cash when you collect your order.'
            : 'Please have the exact amount ready for the rider.'}
        </p>
      ) : null}
    </Section>
  );
}

function TotalsSection({ order }: { order: OrderDetail }) {
  return (
    <Section title="Payment summary" id="totals">
      <dl className="gap-tight flex flex-col text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Subtotal</dt>
          <dd className="text-text font-semibold tabular-nums">
            {formatPkr(order.pricing.subtotal)}
          </dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery charge' : 'Pickup'}
          </dt>
          <dd className="text-text font-semibold tabular-nums">
            {order.fulfillmentMethod === 'DELIVERY'
              ? formatPkr(order.pricing.deliveryFee)
              : 'No charge'}
          </dd>
        </div>

        {order.pricing.discount > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Discount</dt>
            <dd className="text-success font-semibold tabular-nums">
              −{formatPkr(order.pricing.discount)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="bg-cream ring-sand flex items-baseline justify-between rounded-xl px-3 py-2.5 ring-1">
        <span className="text-text text-sm font-bold">Total</span>
        <span
          className="text-primary text-price tabular-nums"
          aria-label={'Total ' + formatPkrLabel(order.pricing.total)}
        >
          {formatPkr(order.pricing.total)}
        </span>
      </div>
    </Section>
  );
}

/** Cancellation, shown only while the server says it is allowed. */
function CancelSection({ order }: { order: OrderDetail }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const cancelOrder = useCancelOrder();

  // `canCancel` is the server's decision, computed from the same rule the API
  // enforces. The button is never shown for an order the API would refuse.
  if (!order.canCancel) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setIsConfirming(true)} fullWidth>
        Cancel this order
      </Button>

      <Modal
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        title="Cancel this order?"
        description={
          'Order ' +
          order.orderNumber +
          ' will be cancelled and nothing will be charged. This cannot be undone.'
        }
        footer={
          <div className="gap-tight flex flex-col-reverse sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsConfirming(false)}>
              Keep my order
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
              Yes, cancel it
            </Button>
          </div>
        }
      >
        <Textarea
          label="Why are you cancelling?"
          hint="Optional. It helps the store improve."
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
