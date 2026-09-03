'use client';

import { Bike, Store } from 'lucide-react';
import { ProductImage } from '@/components/product/product-image';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatPkr, formatPkrLabel, productTint } from '@/lib/format';
import type { CheckoutPreview } from '@/types/order';

export interface OrderSummaryPanelProps {
  preview: CheckoutPreview | null;
  isLoading?: boolean;
  /** Collapses the item list — used in the sticky mobile bar. */
  compact?: boolean;
  className?: string;
}

/** "4.3 km" rather than "4300 m", which is not how anyone thinks about distance. */
export function formatDistance(metres: number): string {
  return metres < 1000 ? metres + ' m' : (metres / 1000).toFixed(1) + ' km';
}

/** "About 15 min". Only ever shown when the routing provider actually gave one. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return 'about ' + minutes + ' min';

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return 'about ' + hours + ' hr' + (rest ? ' ' + rest + ' min' : '');
}

/**
 * The money.
 *
 * Every figure here is the server's. The delivery fee is always a row — never
 * hidden until after the order (§20), and never labelled "free" unless the
 * server actually returned zero, which for a delivery order it does not.
 */
export function OrderSummaryPanel({
  preview,
  isLoading = false,
  compact = false,
  className,
}: OrderSummaryPanelProps) {
  if (isLoading || !preview) {
    return (
      <div
        className={cn(
          'gap-gutter ring-outline-variant bg-surface p-gutter flex flex-col rounded-2xl ring-1',
          className,
        )}
      >
        <Skeleton className="h-5 w-32" label="Calculating your total" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  const isDelivery = preview.fulfillmentMethod === 'DELIVERY';

  return (
    <div
      className={cn(
        'gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1',
        className,
      )}
    >
      <h2 className="text-text text-base font-bold tracking-[-0.015em]">Order summary</h2>

      {!compact ? (
        <ul className="gap-gutter flex list-none flex-col">
          {preview.items.map((item) => (
            <li key={item.productId} className="gap-tight flex items-start">
              <div
                className={cn(
                  'relative size-12 shrink-0 overflow-hidden rounded-lg',
                  productTint(item.productName),
                )}
              >
                <ProductImage
                  image={
                    item.productImage ? { url: item.productImage, alt: item.productName } : null
                  }
                  name={item.productName}
                  sizes="48px"
                  className="size-full p-1"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-text truncate text-sm font-medium">{item.productName}</span>
                <span className="text-text-muted text-xs">
                  {item.unitLabel} · {formatPkr(item.unitPrice)} × {item.quantity}
                </span>
              </div>

              <span className="text-text shrink-0 text-sm font-semibold tabular-nums">
                {formatPkr(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="gap-tight border-outline-variant pt-gutter flex flex-col border-t text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            Subtotal ({preview.totalQuantity === 1 ? '1 item' : preview.totalQuantity + ' items'})
          </dt>
          <dd className="text-text font-medium tabular-nums">{formatPkr(preview.subtotal)}</dd>
        </div>

        <div className="gap-gutter flex items-start justify-between">
          <dt className="text-text-muted flex items-center gap-1.5">
            {isDelivery ? (
              <Bike className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Store className="size-4 shrink-0" aria-hidden="true" />
            )}
            {isDelivery ? 'Delivery' : 'Pickup'}
            {preview.delivery ? (
              <span className="text-text-muted">
                · {formatDistance(preview.delivery.distanceMeters)}
              </span>
            ) : null}
          </dt>

          <dd className="text-text text-end font-medium tabular-nums">
            {/*
              A pickup order genuinely has no delivery charge, so it says so.
              A delivery order always shows the calculated figure — there is no
              path here that can render "Free" for a fee the server did not
              actually return as zero.
            */}
            {isDelivery ? formatPkr(preview.deliveryFee) : 'No charge'}
          </dd>
        </div>

        {preview.discount > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Discount</dt>
            <dd className="text-success font-medium tabular-nums">
              −{formatPkr(preview.discount)}
            </dd>
          </div>
        ) : null}
      </dl>

      {/*
        The total gets its own tinted row rather than one more line in the
        list. It is the number the shopper is agreeing to, and on the old panel
        it sat in the same rhythm as the subtotal and the delivery charge — so
        nothing on the panel had emphasis (§80, §81).
      */}
      <div className="bg-cream ring-sand flex items-baseline justify-between rounded-xl px-3 py-3 ring-1">
        <span className="text-text text-base font-bold">Total to pay</span>
        <span
          className="text-primary text-price-lg tabular-nums"
          aria-label={'Total ' + formatPkrLabel(preview.total)}
        >
          {formatPkr(preview.total)}
        </span>
      </div>

      {preview.delivery?.durationSeconds ? (
        <p className="text-text-muted text-xs">
          Estimated travel time from the store: {formatDuration(preview.delivery.durationSeconds)}.
        </p>
      ) : null}
    </div>
  );
}
