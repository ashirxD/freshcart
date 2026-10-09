import Link from 'next/link';
import { ChevronRight, Store, Truck } from 'lucide-react';
import { ProductImage } from '@/components/product/product-image';
import { Ltr, Money } from '@/components/common/ltr';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { formatPkr, productTint } from '@/lib/format';
import type { OrderSummary } from '@/types/order';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';

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
  const { t, locale } = useI18n();
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
            <span className="text-text font-bold tabular-nums">
              <Ltr>{order.orderNumber}</Ltr>
            </span>
            <span className="text-text-muted text-xs font-medium">
              {formatDate(order.placedAt, locale, 'date')}
            </span>
          </div>

          <OrderStatusBadge
            status={order.status}
            label={order.statusLabel}
            fulfillmentMethod={order.fulfillmentMethod}
            size="sm"
          />
        </div>

        {/* What is in the box, at a glance: a shopper finds "the one with the
            milk and the atta" faster than they read an order number. The names
            stay beside it, because the thumbnails are decoration and a screen
            reader — or a product with no picture yet — still needs the words. */}
        <div className="gap-snug flex items-center">
          <ul className="flex shrink-0 -space-x-2.5" aria-hidden="true">
            {order.previewItems.slice(0, 4).map((item, index) => (
              <li
                key={index}
                className={cn(
                  'ring-surface relative size-11 overflow-hidden rounded-xl ring-2',
                  productTint(item.productName),
                )}
              >
                <ProductImage
                  image={
                    item.productImage ? { url: item.productImage, alt: item.productName } : null
                  }
                  name={item.productName}
                  sizes="44px"
                  className="size-full p-0.5"
                />
              </li>
            ))}
          </ul>

          <p className="text-text-muted line-clamp-2 min-w-0 text-sm">
            {hiddenCount > 0 ? t('orders.list.andMore', { names, count: hiddenCount }) : names}
          </p>
        </div>

        <div className="border-outline-variant gap-x-gutter gap-y-tight flex flex-wrap items-center justify-between border-t pt-2.5">
          <span className="text-text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
            <span className="flex items-center gap-1">
              {order.fulfillmentMethod === 'DELIVERY' ? (
                <Truck className="text-leaf size-3.5" aria-hidden="true" />
              ) : (
                <Store className="text-leaf size-3.5" aria-hidden="true" />
              )}
              {order.fulfillmentMethod === 'DELIVERY'
                ? t('orders.list.delivery')
                : t('orders.list.pickup')}
            </span>

            <span aria-hidden="true">·</span>
            <span>{t('common.itemCount', { count: order.totalQuantity })}</span>

            {order.storeName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{order.storeName}</span>
              </>
            ) : null}

            <PaymentStatusBadge status={order.paymentStatus} />
          </span>

          <span className="text-text flex items-center gap-1">
            <span className="text-price tabular-nums">
              <Money>{formatPkr(order.total)}</Money>
            </span>
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
