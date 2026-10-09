'use client';

import Link from 'next/link';
import { Bike, ChevronRight, Store } from 'lucide-react';
import { Ltr, Money } from '@/components/common/ltr';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { DEFAULT_LOCALE, INTL_TAGS, useI18n, useT, type Locale } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import { actionLabel } from '@/lib/store-copy';
import type { StoreOrderSummary } from '@/types/store-manager';

/** "12:40" for today, "31 Aug 12:40" otherwise — staff scan by time, not date. */
export function formatPlacedAt(
  iso: string,
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const tag = INTL_TAGS[locale];
  const placed = new Date(iso);
  const sameDay = placed.toDateString() === now.toDateString();

  const time = placed.toLocaleTimeString(tag, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (sameDay) return time;

  return placed.toLocaleDateString(tag, { day: 'numeric', month: 'short' }) + ' ' + time;
}

export function FulfillmentBadge({ method }: { method: StoreOrderSummary['fulfillmentMethod'] }) {
  const t = useT();
  const isDelivery = method === 'DELIVERY';
  const Icon = isDelivery ? Bike : Store;

  return (
    <span className="text-text-muted inline-flex items-center gap-1.5 text-xs font-medium">
      <Icon className="size-3.5" aria-hidden="true" />
      {isDelivery ? t('store.fulfillment.DELIVERY') : t('store.fulfillment.PICKUP')}
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
  const { t, locale } = useI18n();

  return (
    <li>
      <Link
        href={'/store-manager/orders/' + order.id}
        className={cn(
          'gap-gutter p-gutter flex items-center rounded-xl ring-1',
          'ease-standard transition-[box-shadow,background-color] duration-200',
          'hover:shadow-card focus-visible:shadow-card',
          // An order waiting on the store gets the apricot ground the whole app
          // uses for "someone is waiting on you", plus a leading marker — so a
          // manager can pick the actionable rows out of a long list at a glance
          // without relying on hue (§73).
          order.needsAction
            ? 'ring-apricot/45 bg-apricot/12 border-attention border-s-4'
            : 'ring-outline-variant bg-surface',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text font-semibold tabular-nums">
              <Ltr>{order.orderNumber}</Ltr>
            </span>
            <OrderStatusBadge
              status={order.status}
              label={order.statusLabel}
              fulfillmentMethod={order.fulfillmentMethod}
              size="sm"
            />
            <FulfillmentBadge method={order.fulfillmentMethod} />
          </div>

          <p className="text-text-muted truncate text-sm">
            <bdi>{order.customer.name}</bdi> · {t('common.itemCount', { count: order.itemCount })} ·{' '}
            <time dateTime={order.placedAt}>{formatPlacedAt(order.placedAt, new Date(), locale)}</time>
          </p>

          {/*
            The next step, stated rather than implied. The server decides what it
            is; this only renders it, which is why a pickup order can never show
            "Out for delivery" here.
          */}
          {order.nextAction ? (
            <p className="text-primary text-xs font-semibold">
              {t('store.orderRow.next', { label: actionLabel(order.nextAction, t, locale) })}
            </p>
          ) : null}
        </div>

        <div className="gap-tight flex shrink-0 flex-col items-end">
          <span className="text-text font-semibold tabular-nums">
            <Money>{formatPkr(order.total)}</Money>
          </span>
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>

        <ChevronRight className="text-outline size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}
