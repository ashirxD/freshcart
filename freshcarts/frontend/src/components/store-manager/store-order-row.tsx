import Link from 'next/link';
import { Bike, ChevronRight, Store } from 'lucide-react';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import type { StoreOrderSummary } from '@/types/store-manager';

/** "12:40" for today, "31 Aug 12:40" otherwise — staff scan by time, not date. */
export function formatPlacedAt(iso: string, now: Date = new Date()): string {
  const placed = new Date(iso);
  const sameDay = placed.toDateString() === now.toDateString();

  const time = placed.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (sameDay) return time;

  return (
    placed.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) + ' ' + time
  );
}

export function FulfillmentBadge({ method }: { method: StoreOrderSummary['fulfillmentMethod'] }) {
  const isDelivery = method === 'DELIVERY';
  const Icon = isDelivery ? Bike : Store;

  return (
    <span className="text-text-muted inline-flex items-center gap-1.5 text-xs font-medium">
      <Icon className="size-3.5" aria-hidden="true" />
      {isDelivery ? 'Delivery' : 'Pickup'}
    </span>
  );
}

/**
 * One order in the queue, as a card.
 *
 * Cards on every breakpoint rather than a table on desktop. A table row is a
 * poor fit here: the useful unit is "this order and the one thing to do about
 * it", and staff act on rows one at a time — they do not compare columns. It
 * also means one component instead of a table and a card list that drift apart,
 * and it avoids the horizontal scrolling §42 warns against.
 *
 * The whole card is a link to the order, with `needsAction` raising the ones the
 * store is holding up.
 */
export function StoreOrderRow({ order }: { order: StoreOrderSummary }) {
  return (
    <li>
      <Link
        href={'/store-manager/orders/' + order.id}
        className={cn(
          'gap-gutter flex items-center rounded-lg border p-gutter transition-shadow',
          'hover:shadow-card focus-visible:shadow-card',
          order.needsAction
            ? 'border-primary/30 bg-primary/[0.03]'
            : 'border-outline-variant bg-surface',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text font-semibold tabular-nums">{order.orderNumber}</span>
            <OrderStatusBadge status={order.status} label={order.statusLabel} size="sm" />
            <FulfillmentBadge method={order.fulfillmentMethod} />
          </div>

          <p className="text-text-muted truncate text-sm">
            {order.customer.name} ·{' '}
            {order.itemCount === 1 ? '1 item' : order.itemCount + ' items'} ·{' '}
            <time dateTime={order.placedAt}>{formatPlacedAt(order.placedAt)}</time>
          </p>

          {/*
            The next step, stated rather than implied. The server decides what it
            is; this only renders it, which is why a pickup order can never show
            "Out for delivery" here.
          */}
          {order.nextAction ? (
            <p className="text-primary text-xs font-semibold">Next: {order.nextAction.label}</p>
          ) : null}
        </div>

        <div className="gap-xs flex shrink-0 flex-col items-end">
          <span className="text-text font-semibold tabular-nums">{formatPkr(order.total)}</span>
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>

        <ChevronRight className="text-outline size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}
