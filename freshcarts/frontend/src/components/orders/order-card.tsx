import Link from 'next/link';
import { ChevronRight, Store, Truck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import type { OrderSummary } from '@/types/order';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';

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
 * no who-did-what history.
 */
export function OrderCard({ order }: { order: OrderSummary }) {
  const names = order.previewItems.map((item) => item.productName).join(', ');
  const hiddenCount = order.itemCount - order.previewItems.length;

  return (
    <li className="list-none">
      <Link
        href={'/orders/' + order.id}
        className={cn(
          'group gap-snug ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1',
          'ease-standard transition-[transform,box-shadow] duration-200',
          'hover:shadow-raised hover:-translate-y-0.5',
        )}
      >
        <div className="gap-gutter flex items-start justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-text font-bold tabular-nums">{order.orderNumber}</span>
            <span className="text-text-muted text-xs font-medium">
              {formatDate(order.placedAt)}
            </span>
          </div>

          <OrderStatusBadge status={order.status} label={order.statusLabel} size="sm" />
        </div>

        <p className="text-text-muted line-clamp-2 text-sm">
          {names}
          {hiddenCount > 0 ? ' and ' + hiddenCount + ' more' : ''}
        </p>

        <div className="border-outline-variant gap-x-gutter gap-y-tight flex flex-wrap items-center justify-between border-t pt-2.5">
          <span className="text-text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
            <span className="flex items-center gap-1">
              {order.fulfillmentMethod === 'DELIVERY' ? (
                <Truck className="text-leaf size-3.5" aria-hidden="true" />
              ) : (
                <Store className="text-leaf size-3.5" aria-hidden="true" />
              )}
              {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}
            </span>

            <span aria-hidden="true">·</span>
            <span>{order.totalQuantity === 1 ? '1 item' : order.totalQuantity + ' items'}</span>

            {order.storeName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{order.storeName}</span>
              </>
            ) : null}

            <PaymentStatusBadge status={order.paymentStatus} />
          </span>

          <span className="text-text flex items-center gap-1">
            <span className="text-price tabular-nums">{formatPkr(order.total)}</span>
            <ChevronRight
              className="text-outline ease-standard size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}
