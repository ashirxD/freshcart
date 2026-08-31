import Link from 'next/link';
import { ChevronRight, Store, Truck } from 'lucide-react';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';
import { formatPkr } from '@/lib/format';
import type { OrderSummary } from '@/types/order';

/** "2 Feb 2026" — a date a shopper recognises, without the noise of a time. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * One row in the order history.
 *
 * The whole card is a single link, so it is one tab stop and one large touch
 * target rather than a grid of competing controls. Everything shown comes from
 * the order's own snapshot — product names included — so a row still reads
 * correctly for a product that has since been renamed or withdrawn.
 *
 * Deliberately absent: anything operational. No internal ids, no store notes,
 * no who-did-what history (§35).
 */
export function OrderCard({ order }: { order: OrderSummary }) {
  const names = order.previewItems.map((item) => item.productName).join(', ');
  const hiddenCount = order.itemCount - order.previewItems.length;

  return (
    <li className="list-none">
      <Link
        href={'/orders/' + order.id}
        className="flex min-h-touch flex-col gap-xs rounded-lg border border-outline-variant bg-surface p-gutter transition-colors hover:border-outline"
      >
        <div className="flex items-start justify-between gap-gutter">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold tabular-nums text-text">{order.orderNumber}</span>
            <span className="text-xs text-text-muted">{formatDate(order.placedAt)}</span>
          </div>

          <OrderStatusBadge status={order.status} label={order.statusLabel} size="sm" />
        </div>

        <p className="line-clamp-2 text-sm text-text-muted">
          {names}
          {hiddenCount > 0 ? ' and ' + hiddenCount + ' more' : ''}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-x-gutter gap-y-xs pt-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              {order.fulfillmentMethod === 'DELIVERY' ? (
                <Truck className="size-3.5" aria-hidden="true" />
              ) : (
                <Store className="size-3.5" aria-hidden="true" />
              )}
              {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}
            </span>

            <span aria-hidden="true">·</span>
            <span>
              {order.totalQuantity === 1 ? '1 item' : order.totalQuantity + ' items'}
            </span>

            {order.storeName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{order.storeName}</span>
              </>
            ) : null}

            <PaymentStatusBadge status={order.paymentStatus} />
          </span>

          <span className="flex items-center gap-1 font-semibold tabular-nums text-text">
            {formatPkr(order.total)}
            <ChevronRight className="size-4 text-outline" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  );
}
