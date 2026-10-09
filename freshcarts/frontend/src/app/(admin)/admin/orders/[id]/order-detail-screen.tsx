'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Receipt, ShieldAlert, Store } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { OverrideStatusDialog } from '@/components/admin/override-status-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Ltr, Money } from '@/components/common/ltr';
import { formatDistance } from '@/components/checkout/order-summary-panel';
import { ErrorState } from '@/components/common/error-state';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminOrder } from '@/features/admin/admin.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { whoLabel } from '@/lib/admin-copy';
import { ApiError } from '@/lib/api/errors';
import { formatDate } from '@/lib/dates';
import { formatPkr } from '@/lib/format';
import { orderNote, orderStatusLabel } from '@/lib/order-copy';
import type { AdminOrderDetail } from '@/types/admin';

/**
 * ONE ORDER, AS IT WAS SOLD
 *
 * Every figure on this screen comes from the order's own snapshot — the item
 * names, the unit prices, the delivery distance, the fee, the address. Nothing
 * is re-read from today's catalogue or re-priced from today's rules, which is
 * what makes a six-month-old receipt still add up (section 20, section 54).
 *
 * The only write is the override, and it is deliberately behind a dialog that
 * demands a reason: an admin moving an order outside the normal queue is doing
 * something that needs explaining to the customer reading the timeline.
 */
export function AdminOrderDetailScreen({ id }: { id: string }) {
  const { t, tx, locale } = useI18n();
  const [isOverriding, setOverriding] = useState(false);
  const { data: order, isPending, isError, error, refetch } = useAdminOrder(id);

  if (isPending) {
    return (
      <>
        <AdminPageHeader title={t('admin.meta.order')} description={t('common.loading')} />
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-14 w-full" label={t('admin.orderDetail.loadingLabel')} />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404;

    return missing ? (
      <EmptyState
        icon={<Receipt className="size-7" aria-hidden="true" />}
        title={t('admin.orderDetail.notFoundTitle')}
        description={t('admin.orderDetail.notFoundBody')}
        action={<ButtonLink href="/admin/orders">{t('admin.orderDetail.backToOrders')}</ButtonLink>}
        className="bg-surface-muted rounded-lg"
      />
    ) : (
      <ErrorState error={error} onRetry={() => void refetch()} />
    );
  }

  return (
    <>
      <Link
        href="/admin/orders"
        className="text-text-muted hover:text-text min-h-touch mb-tight inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('admin.orderDetail.allOrders')}
      </Link>

      <AdminPageHeader
        title={<Ltr>{order.orderNumber}</Ltr>}
        description={
          <span className="gap-tight flex flex-wrap items-center">
            <OrderStatusBadge
              status={order.status}
              label={order.statusLabel}
              fulfillmentMethod={order.fulfillmentMethod}
              size="sm"
            />
            <span>·</span>
            <span>
              {t(
                order.fulfillmentMethod === 'DELIVERY'
                  ? 'store.fulfillment.DELIVERY'
                  : 'store.fulfillment.PICKUP',
              )}
            </span>
            <span>·</span>
            <span>
              <bdi>{order.store.name}</bdi>
            </span>
          </span>
        }
        actions={
          order.availableActions.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => setOverriding(true)}
              leadingIcon={<ShieldAlert className="size-4" aria-hidden="true" />}
            >
              {t('admin.orderDetail.override')}
            </Button>
          ) : null
        }
      />

      <div className="gap-loose grid lg:grid-cols-[2fr_1fr]">
        <div className="gap-loose flex flex-col">
          <Section title={t('admin.orderDetail.items')}>
            <ul className="flex flex-col">
              {order.items.map((item) => (
                <li
                  key={item.productId}
                  className="border-outline-variant gap-gutter flex items-start justify-between border-b py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-text text-sm font-medium">
                      <bdi>{item.productName}</bdi>
                    </p>
                    <p className="text-text-muted text-xs">
                      {item.unitLabel} · <Ltr>{item.sku}</Ltr>
                    </p>
                  </div>

                  <div className="text-end whitespace-nowrap">
                    <p className="text-text text-sm tabular-nums">
                      <Money>
                        {item.quantity} × {formatPkr(item.unitPrice)}
                      </Money>
                    </p>
                    <p className="text-text text-sm font-semibold tabular-nums">
                      <Money>{formatPkr(item.lineTotal)}</Money>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="border-outline-variant mt-gutter gap-tight flex flex-col border-t pt-3 text-sm">
              <Row
                label={t('common.subtotal')}
                value={<Money>{formatPkr(order.pricing.subtotal)}</Money>}
              />

              {order.fulfillmentMethod === 'DELIVERY' ? (
                <Row
                  label={t('admin.orderDetail.deliveryFee')}
                  value={<Money>{formatPkr(order.pricing.deliveryFee)}</Money>}
                />
              ) : null}

              {order.pricing.discount > 0 ? (
                <Row
                  label={t('admin.orderDetail.discount')}
                  value={<Money>{'−' + formatPkr(order.pricing.discount)}</Money>}
                />
              ) : null}

              <Row
                label={t('common.total')}
                value={<Money>{formatPkr(order.pricing.total)}</Money>}
                emphasis
              />
            </dl>
          </Section>

          <Section title={t('admin.orderDetail.history')}>
            <ol className="gap-gutter flex flex-col">
              {order.statusHistory.map((entry, index) => (
                <li key={index} className="gap-gutter flex items-start">
                  <span
                    className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-text text-sm font-medium">
                      {orderStatusLabel(
                        entry.status,
                        order.fulfillmentMethod,
                        entry.statusLabel,
                        t,
                        locale,
                      )}
                    </p>
                    <p className="text-text-muted text-sm">
                      <bdi>{orderNote(entry.note, t, locale)}</bdi>
                    </p>
                    <p className="text-text-muted text-xs">
                      {tx('admin.orderDetail.changedBy', {
                        when: <bdi>{formatDate(entry.changedAt, locale, 'moment')}</bdi>,
                        who: whoLabel(entry.changedByRole, locale),
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="gap-loose flex flex-col">
          <Section title={t('admin.orderDetail.customer')}>
            <p className="text-text text-sm font-medium">
              <bdi>{order.customer.name}</bdi>
            </p>
            <a
              href={'tel:' + order.customer.phone}
              className="text-primary min-h-touch inline-flex items-center gap-2 text-sm tabular-nums"
            >
              <Phone className="size-4" aria-hidden="true" />
              <Ltr>{order.customer.phone}</Ltr>
            </a>

            {order.customerNote ? (
              <p className="bg-surface-muted p-gutter text-text mt-tight rounded-lg text-sm">
                “<bdi>{order.customerNote}</bdi>”
              </p>
            ) : null}
          </Section>

          {order.deliveryAddress ? (
            <Section title={t('admin.orderDetail.deliveringTo')}>
              <p className="text-text flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <bdi>{order.deliveryAddress.formatted}</bdi>
                </span>
              </p>

              {order.deliveryAddress.landmark ? (
                <p className="text-text-muted text-sm">
                  {tx('admin.orderDetail.near', {
                    landmark: <bdi>{order.deliveryAddress.landmark}</bdi>,
                  })}
                </p>
              ) : null}

              {order.delivery ? (
                <p className="text-text-muted mt-tight text-sm tabular-nums">
                  {tx('admin.orderDetail.distanceCharged', {
                    distance: <Ltr>{formatDistance(order.delivery.distanceMeters, t)}</Ltr>,
                    fee: <Money>{formatPkr(order.delivery.fee)}</Money>,
                  })}
                </p>
              ) : null}
            </Section>
          ) : null}

          {order.pickup ? (
            <Section title={t('admin.orderDetail.collectingFrom')}>
              <p className="text-text flex items-start gap-2 text-sm">
                <Store className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <bdi>{order.pickup.storeName}</bdi>
                  <br />
                  <bdi>{order.pickup.storeAddress}</bdi>
                </span>
              </p>
            </Section>
          ) : null}

          <Section title={t('admin.orderDetail.payment')}>
            <div className="gap-tight flex flex-wrap items-center">
              <span className="text-text text-sm">
                {t(('checkout.payment.method.' + order.payment.method) as TranslationKey)}
              </span>
              <PaymentStatusBadge status={order.payment.status} />
            </div>

            {order.payment.paidAt ? (
              <p className="text-text-muted text-xs">
                {tx('admin.orderDetail.collected', {
                  when: <bdi>{formatDate(order.payment.paidAt, locale, 'moment')}</bdi>,
                })}
              </p>
            ) : (
              // Payment status is moved by the order lifecycle, never by hand:
              // cash is marked collected when the order is handed over.
              <p className="text-text-muted text-xs">
                {t('admin.orderDetail.cashNote')}
              </p>
            )}
          </Section>

          {order.cancellation ? (
            <Section title={t('admin.orderDetail.cancellation')}>
              <p className="text-text text-sm">
                {order.cancellation.reason ? (
                  <bdi>{order.cancellation.reason}</bdi>
                ) : (
                  t('admin.orderDetail.noReason')
                )}
              </p>
              <p className="text-text-muted text-xs">
                {tx('admin.orderDetail.cancelledBy', {
                  who: whoLabel(order.cancellation.byRole ?? 'SYSTEM', locale),
                  when: <bdi>{formatDate(order.cancellation.cancelledAt, locale, 'shortDate')}</bdi>,
                })}
              </p>
            </Section>
          ) : null}
        </div>
      </div>

      <OverrideStatusDialog
        order={order}
        open={isOverriding}
        onClose={() => setOverriding(false)}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-outline-variant bg-surface p-gutter rounded-lg border">
      <h2 className="text-text mb-gutter text-base font-semibold">{title}</h2>
      <div className="gap-tight flex flex-col">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={emphasis ? 'text-text font-semibold' : 'text-text-muted'}>{label}</dt>
      <dd className={'tabular-nums ' + (emphasis ? 'text-text font-semibold' : 'text-text')}>
        {value}
      </dd>
    </div>
  );
}

export type { AdminOrderDetail };
