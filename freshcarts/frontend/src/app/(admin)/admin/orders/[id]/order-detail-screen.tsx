'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Receipt, ShieldAlert, Store } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { OverrideStatusDialog } from '@/components/admin/override-status-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminOrder } from '@/features/admin/admin.hooks';
import { ApiError } from '@/lib/api/errors';
import { formatPkr } from '@/lib/format';
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
  const [isOverriding, setOverriding] = useState(false);
  const { data: order, isPending, isError, error, refetch } = useAdminOrder(id);

  if (isPending) {
    return (
      <>
        <AdminPageHeader title="Order" description="Loading…" />
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-14 w-full" label="Loading the order" />
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
        title="Order not found"
        description="This order no longer exists, or the link is wrong."
        action={<ButtonLink href="/admin/orders">Back to orders</ButtonLink>}
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
        className="text-text-muted hover:text-text min-h-touch mb-xs inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        All orders
      </Link>

      <AdminPageHeader
        title={order.orderNumber}
        description={
          <span className="gap-xs flex flex-wrap items-center">
            <OrderStatusBadge status={order.status} label={order.statusLabel} size="sm" />
            <span>·</span>
            <span>{order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}</span>
            <span>·</span>
            <span>{order.store.name}</span>
          </span>
        }
        actions={
          order.availableActions.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => setOverriding(true)}
              leadingIcon={<ShieldAlert className="size-4" aria-hidden="true" />}
            >
              Override status
            </Button>
          ) : null
        }
      />

      <div className="gap-lg grid lg:grid-cols-[2fr_1fr]">
        <div className="gap-lg flex flex-col">
          <Section title="Items">
            <ul className="flex flex-col">
              {order.items.map((item) => (
                <li
                  key={item.productId}
                  className="border-outline-variant gap-gutter flex items-start justify-between border-b py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-text text-sm font-medium">{item.productName}</p>
                    <p className="text-text-muted text-xs">
                      {item.unitLabel} · {item.sku}
                    </p>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <p className="text-text text-sm tabular-nums">
                      {item.quantity} × {formatPkr(item.unitPrice)}
                    </p>
                    <p className="text-text text-sm font-semibold tabular-nums">
                      {formatPkr(item.lineTotal)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="border-outline-variant mt-gutter gap-xs flex flex-col border-t pt-3 text-sm">
              <Row label="Subtotal" value={formatPkr(order.pricing.subtotal)} />

              {order.fulfillmentMethod === 'DELIVERY' ? (
                <Row label="Delivery fee" value={formatPkr(order.pricing.deliveryFee)} />
              ) : null}

              {order.pricing.discount > 0 ? (
                <Row label="Discount" value={'−' + formatPkr(order.pricing.discount)} />
              ) : null}

              <Row label="Total" value={formatPkr(order.pricing.total)} emphasis />
            </dl>
          </Section>

          <Section title="What happened">
            <ol className="gap-gutter flex flex-col">
              {order.statusHistory.map((entry, index) => (
                <li key={index} className="gap-gutter flex items-start">
                  <span
                    className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-text text-sm font-medium">{entry.statusLabel}</p>
                    <p className="text-text-muted text-sm">{entry.note}</p>
                    <p className="text-text-muted text-xs">
                      {new Date(entry.changedAt).toLocaleString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' · by '}
                      {roleLabel(entry.changedByRole)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="gap-lg flex flex-col">
          <Section title="Customer">
            <p className="text-text text-sm font-medium">{order.customer.name}</p>
            <a
              href={'tel:' + order.customer.phone}
              className="text-primary min-h-touch inline-flex items-center gap-2 text-sm tabular-nums"
            >
              <Phone className="size-4" aria-hidden="true" />
              {order.customer.phone}
            </a>

            {order.customerNote ? (
              <p className="bg-surface-muted p-gutter text-text mt-xs rounded-lg text-sm">
                “{order.customerNote}”
              </p>
            ) : null}
          </Section>

          {order.deliveryAddress ? (
            <Section title="Delivering to">
              <p className="text-text gap-2 flex items-start text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{order.deliveryAddress.formatted}</span>
              </p>

              {order.deliveryAddress.landmark ? (
                <p className="text-text-muted text-sm">Near {order.deliveryAddress.landmark}</p>
              ) : null}

              {order.delivery ? (
                <p className="text-text-muted mt-xs text-sm tabular-nums">
                  {(order.delivery.distanceMeters / 1000).toFixed(1)} km ·{' '}
                  {formatPkr(order.delivery.fee)} charged
                </p>
              ) : null}
            </Section>
          ) : null}

          {order.pickup ? (
            <Section title="Collecting from">
              <p className="text-text gap-2 flex items-start text-sm">
                <Store className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {order.pickup.storeName}
                  <br />
                  {order.pickup.storeAddress}
                </span>
              </p>
            </Section>
          ) : null}

          <Section title="Payment">
            <div className="gap-xs flex flex-wrap items-center">
              <span className="text-text text-sm">
                {order.payment.method === 'CASH_ON_DELIVERY'
                  ? 'Cash on delivery'
                  : order.payment.method}
              </span>
              <PaymentStatusBadge status={order.payment.status} />
            </div>

            {order.payment.paidAt ? (
              <p className="text-text-muted text-xs">
                Collected{' '}
                {new Date(order.payment.paidAt).toLocaleString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            ) : (
              // Payment status is moved by the order lifecycle, never by hand:
              // cash is marked collected when the order is handed over.
              <p className="text-text-muted text-xs">
                Cash is recorded as collected when the order is handed over.
              </p>
            )}
          </Section>

          {order.cancellation ? (
            <Section title="Cancellation">
              <p className="text-text text-sm">{order.cancellation.reason ?? 'No reason given'}</p>
              <p className="text-text-muted text-xs">
                {roleLabel(order.cancellation.byRole ?? 'SYSTEM')} ·{' '}
                {new Date(order.cancellation.cancelledAt).toLocaleDateString('en-PK', {
                  day: 'numeric',
                  month: 'short',
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
      <div className="gap-xs flex flex-col">{children}</div>
    </section>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={emphasis ? 'text-text font-semibold' : 'text-text-muted'}>{label}</dt>
      <dd className={'tabular-nums ' + (emphasis ? 'text-text font-semibold' : 'text-text')}>
        {value}
      </dd>
    </div>
  );
}

/** Internal role enums, in words a person reads (section 46). */
function roleLabel(role: string): string {
  return (
    { CUSTOMER: 'the customer', STORE_MANAGER: 'store staff', ADMIN: 'an administrator', SYSTEM: 'FreshCarts' }[
      role
    ] ?? role.toLowerCase()
  );
}

export type { AdminOrderDetail };
