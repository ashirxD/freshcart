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
import { formatPkr, formatPkrLabel } from '@/lib/format';
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
      <Container className="flex flex-col gap-gutter py-lg">
        <Skeleton className="h-8 w-48" label="Loading your order" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-lg">
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We could not open this order"
        />
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-lg py-lg">
      <header className="flex flex-col gap-gutter">
        <Link
          href="/orders"
          className="-ms-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All orders
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-gutter">
          <div className="flex flex-col gap-1">
            <h1 id="main-content" className="text-xl font-semibold tabular-nums text-text">
              {order.orderNumber}
            </h1>
            <p className="text-sm text-text-muted">Placed {formatDateTime(order.placedAt)}</p>
          </div>

          <OrderStatusBadge status={order.status} label={order.statusLabel} />
        </div>
      </header>

      <div className="flex flex-col gap-lg lg:flex-row lg:items-start lg:gap-8">
        <div className="flex flex-1 flex-col gap-lg">
          <TrackingSection order={order} />
          <ItemsSection order={order} />
        </div>

        <aside className="flex w-full flex-col gap-lg lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
          <FulfilmentSection order={order} />
          <PaymentSection order={order} />
          <TotalsSection order={order} />
          <CancelSection order={order} />
        </aside>
      </div>
    </Container>
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
      className="flex flex-col gap-gutter rounded-lg border border-outline-variant bg-surface p-gutter"
    >
      <h2 id={headingId} className="text-base font-semibold text-text">
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
        <p className="rounded-md bg-surface-muted p-gutter text-sm text-text-muted">
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
      <ul className="flex list-none flex-col divide-y divide-outline-variant">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-start gap-gutter py-gutter first:pt-0 last:pb-0">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
              <ProductImage
                image={item.productImage ? { url: item.productImage, alt: item.productName } : null}
                name={item.productName}
                sizes="64px"
                className="size-full"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {item.brand ? <span className="text-xs text-text-muted">{item.brand}</span> : null}
              <span className="text-sm font-medium text-text">{item.productName}</span>
              <span className="text-xs text-text-muted">
                {item.unitLabel} · {formatPkr(item.unitPrice)} × {item.quantity}
              </span>
            </div>

            <span className="shrink-0 text-sm font-semibold tabular-nums text-text">
              {formatPkr(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      {order.customerNote ? (
        <p className="rounded-md bg-surface-muted p-gutter text-sm text-text-muted">
          <span className="font-medium text-text">Your note: </span>
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
          <p className="flex items-center gap-1.5 font-medium text-text">
            <Store className="size-4" aria-hidden="true" />
            {order.pickup.storeName}
          </p>
          <p className="text-text-muted">{order.pickup.storeAddress}</p>
          <a
            href={'tel:' + order.pickup.storePhone}
            className="flex min-h-11 items-center gap-1.5 text-primary"
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
        <p className="font-medium text-text">{order.deliveryAddress.recipientName}</p>
        <p className="text-text-muted">{order.deliveryAddress.formatted}</p>
        <a
          href={'tel:' + order.deliveryAddress.phone}
          className="flex min-h-11 items-center gap-1.5 text-primary"
        >
          <Phone className="size-4" aria-hidden="true" />
          {order.deliveryAddress.phone}
        </a>

        {order.deliveryAddress.deliveryInstructions ? (
          <p className="flex items-start gap-1.5 text-text-muted">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {order.deliveryAddress.deliveryInstructions}
          </p>
        ) : null}

        {order.delivery ? (
          <p className="flex items-center gap-1.5 pt-1 text-text-muted">
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
      <div className="flex items-center justify-between gap-gutter text-sm">
        <span className="text-text">{methodLabel}</span>
        <PaymentStatusBadge status={order.payment.status} />
      </div>

      {order.payment.paidAt ? (
        <p className="text-xs text-text-muted">Paid on {formatDateTime(order.payment.paidAt)}</p>
      ) : order.payment.status === 'PENDING' ? (
        <p className="text-xs text-text-muted">
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
      <dl className="flex flex-col gap-xs text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Subtotal</dt>
          <dd className="tabular-nums text-text">{formatPkr(order.pricing.subtotal)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery charge' : 'Pickup'}
          </dt>
          <dd className="tabular-nums text-text">
            {order.fulfillmentMethod === 'DELIVERY'
              ? formatPkr(order.pricing.deliveryFee)
              : 'No charge'}
          </dd>
        </div>

        {order.pricing.discount > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Discount</dt>
            <dd className="tabular-nums text-success">−{formatPkr(order.pricing.discount)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex items-baseline justify-between border-t border-outline-variant pt-gutter">
        <span className="text-base font-semibold text-text">Total</span>
        <span
          className="text-lg font-bold tabular-nums text-primary"
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
          <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
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
