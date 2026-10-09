'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Store } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Ltr, Money } from '@/components/common/ltr';
import { formatDistance } from '@/components/checkout/order-summary-panel';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { OrderActionBar } from '@/components/store-manager/order-action-bar';
import { PickingList } from '@/components/store-manager/picking-list';
import { SubstitutionDialog } from '@/components/store-manager/substitution-dialog';
import { FulfillmentBadge } from '@/components/store-manager/store-order-row';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCancelSubstitution, useStoreOrder } from '@/features/store-manager/store-manager.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { formatDate } from '@/lib/dates';
import { formatPkr } from '@/lib/format';
import { orderNote, orderStatusLabel } from '@/lib/order-copy';
import { roleLabel } from '@/lib/store-copy';
import type { StoreOrderDetail, StoreOrderItem } from '@/types/store-manager';

/** The states in which an order's lines may still be swapped, per the API. */
const EDITABLE_STATUSES = ['CONFIRMED', 'PREPARING'];

/**
 * The order fulfilment screen.
 *
 * Everything a picker, a packer and whoever hands the bag over needs, in the
 * order they need it: what to do next, what to put in the bag, where it is
 * going, and what happened so far.
 */
export function OrderDetailScreen({ id }: { id: string }) {
  const { t, tx, locale } = useI18n();
  const [substituting, setSubstituting] = useState<StoreOrderItem | null>(null);
  const { data: order, isPending, isError, error, refetch } = useStoreOrder(id);

  if (isPending) {
    return (
      <Container className="gap-loose flex flex-col">
        <Skeleton className="h-7 w-56" label={t('store.detail.loading')} />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </Container>
    );
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404;

    return (
      <Container>
        {missing ? (
          <EmptyState
            icon={<Store className="size-7" aria-hidden="true" />}
            title={t('store.detail.notFoundTitle')}
            description={t('store.detail.notFoundBody')}
            action={
              <ButtonLink href="/store-manager/orders">{t('store.detail.backToOrders')}</ButtonLink>
            }
            className="bg-surface-muted rounded-lg"
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </Container>
    );
  }

  const canSubstitute = EDITABLE_STATUSES.includes(order.status);

  return (
    <Container className="gap-loose flex flex-col">
      <Link
        href="/store-manager/orders"
        className="text-text-muted hover:text-text inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('store.detail.allOrders')}
      </Link>

      <header className="gap-gutter flex flex-wrap items-start justify-between">
        <div className="gap-tight flex flex-col">
          <h1 className="text-text text-xl font-semibold tabular-nums">
            <Ltr>{order.orderNumber}</Ltr>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge
              status={order.status}
              label={order.statusLabel}
              fulfillmentMethod={order.fulfillmentMethod}
            />
            <FulfillmentBadge method={order.fulfillmentMethod} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        <p className="text-text text-xl font-bold tabular-nums">
          <Money>{formatPkr(order.total)}</Money>
        </p>
      </header>

      {/* What to do next, at the top where it cannot be missed (§45). */}
      <section
        className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
        aria-labelledby="actions-heading"
      >
        <h2 id="actions-heading" className="text-text text-base font-semibold">
          {t('store.detail.nextStep')}
        </h2>
        <OrderActionBar order={order} />
      </section>

      {order.cancellation ? (
        <p className="bg-danger/5 text-danger p-gutter rounded-lg text-sm">
          <span className="font-semibold">
            {tx('store.detail.statusOn', {
              status: orderStatusLabel(
                order.status,
                order.fulfillmentMethod,
                order.statusLabel,
                t,
                locale,
              ),
              date: <bdi>{formatDate(order.cancellation.cancelledAt, locale, 'dateTime')}</bdi>,
            })}
          </span>
          {order.cancellation.reason ? (
            <>
              {' — '}
              <bdi>{order.cancellation.reason}</bdi>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="gap-loose flex flex-col lg:flex-row lg:items-start">
        <div className="gap-loose flex min-w-0 flex-1 flex-col">
          <PickingList order={order} onSubstitute={canSubstitute ? setSubstituting : undefined} />

          <SubstitutionHistory order={order} />
        </div>

        <aside className="gap-loose flex w-full flex-col lg:w-80 lg:shrink-0">
          <FulfillmentPanel order={order} />
          <PricingPanel order={order} />
          <HistoryPanel order={order} />
        </aside>
      </div>

      <SubstitutionDialog
        orderId={order.id}
        item={substituting}
        onClose={() => setSubstituting(null)}
      />
    </Container>
  );
}

/**
 * Where the order is going, and who to call.
 *
 * Exactly the fields fulfilment needs (§24). The coordinates become a map link
 * rather than an embedded map — §25 allows handing them to a navigation app and
 * explicitly rules out building one.
 */
function FulfillmentPanel({ order }: { order: StoreOrderDetail }) {
  const { t, tx } = useI18n();
  const address = order.deliveryAddress;

  return (
    <section
      className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
      aria-labelledby="fulfilment-heading"
    >
      <h2 id="fulfilment-heading" className="text-text text-base font-semibold">
        {t(
          order.fulfillmentMethod === 'DELIVERY'
            ? 'store.fulfillment.DELIVERY'
            : 'store.fulfillment.PICKUP',
        )}
      </h2>

      <div className="gap-tight flex flex-col text-sm">
        <p className="text-text font-medium">
          <bdi>{order.customer.name}</bdi>
        </p>

        {order.customer.phone ? (
          <a
            href={'tel:' + order.customer.phone}
            className="text-primary min-h-touch inline-flex items-center gap-1.5 font-medium"
          >
            <Phone className="size-4" aria-hidden="true" />
            <Ltr>{order.customer.phone}</Ltr>
          </a>
        ) : null}
      </div>

      {address ? (
        <div className="gap-tight flex flex-col text-sm">
          <p className="text-text">
            <bdi>{address.formatted}</bdi>
          </p>
          {address.landmark ? (
            <p className="text-text-muted">
              {tx('store.detail.landmark', { landmark: <bdi>{address.landmark}</bdi> })}
            </p>
          ) : null}
          {address.deliveryInstructions ? (
            <p className="bg-secondary-container/20 text-text rounded-md px-2 py-1">
              <bdi>{address.deliveryInstructions}</bdi>
            </p>
          ) : null}

          {order.delivery ? (
            <p className="text-text-muted">
              {tx('store.detail.distanceFee', {
                distance: <Ltr>{formatDistance(order.delivery.distanceMeters, t)}</Ltr>,
                fee: <Money>{formatPkr(order.delivery.fee)}</Money>,
              })}
            </p>
          ) : null}

          <a
            href={
              'https://www.google.com/maps/search/?api=1&query=' +
              address.latitude +
              ',' +
              address.longitude
            }
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary min-h-touch inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <MapPin className="size-4" aria-hidden="true" />
            {t('store.detail.openMaps')}
          </a>
        </div>
      ) : order.pickup ? (
        <div className="gap-tight flex flex-col text-sm">
          <p className="text-text font-medium">
            <bdi>{order.pickup.storeName}</bdi>
          </p>
          <p className="text-text-muted">
            <bdi>{order.pickup.storeAddress}</bdi>
          </p>
          {order.pickup.instructions ? (
            <p className="text-text-muted">
              <bdi>{order.pickup.instructions}</bdi>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PricingPanel({ order }: { order: StoreOrderDetail }) {
  const { t } = useI18n();

  return (
    <section
      className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
      aria-labelledby="pricing-heading"
    >
      <h2 id="pricing-heading" className="text-text text-base font-semibold">
        {t('store.detail.paymentHeading')}
      </h2>

      <dl className="gap-tight flex flex-col text-sm">
        <Row label={t('common.subtotal')} value={<Money>{formatPkr(order.pricing.subtotal)}</Money>} />
        {order.pricing.deliveryFee > 0 ? (
          <Row
            label={t('store.detail.deliveryRow')}
            value={<Money>{formatPkr(order.pricing.deliveryFee)}</Money>}
          />
        ) : null}
        <Row
          label={t('common.total')}
          value={<Money>{formatPkr(order.pricing.total)}</Money>}
          emphasis
        />
        <Row
          label={t('store.detail.method')}
          value={t(('checkout.payment.method.' + order.paymentMethod) as TranslationKey)}
        />
      </dl>
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
    <div className="flex items-center justify-between gap-2">
      <dt className="text-text-muted">{label}</dt>
      <dd className={emphasis ? 'text-text font-bold tabular-nums' : 'text-text tabular-nums'}>
        {value}
      </dd>
    </div>
  );
}

/** The audit trail, including who acted — which the customer's view withholds. */
function HistoryPanel({ order }: { order: StoreOrderDetail }) {
  const { t, locale } = useI18n();

  return (
    <section
      className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
      aria-labelledby="history-heading"
    >
      <h2 id="history-heading" className="text-text text-base font-semibold">
        {t('store.detail.history')}
      </h2>

      <ol className="gap-gutter flex list-none flex-col">
        {order.statusHistory.map((entry, index) => (
          <li key={index} className="flex flex-col gap-0.5 text-sm">
            <span className="text-text font-medium">
              {orderStatusLabel(
                entry.status,
                order.fulfillmentMethod,
                entry.statusLabel,
                t,
                locale,
              )}
            </span>
            <span className="text-text-muted text-xs">
              <time dateTime={entry.changedAt}>
                <bdi>{formatDate(entry.changedAt, locale, 'dateTime')}</bdi>
              </time>
              {' · '}
              {roleLabel(entry.changedByRole, locale)}
            </span>
            <span className="text-text-muted">
              <bdi>{orderNote(entry.note, t, locale)}</bdi>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Replacements proposed on this order, and their outcome. */
function SubstitutionHistory({ order }: { order: StoreOrderDetail }) {
  const { t, tx } = useI18n();
  const cancel = useCancelSubstitution();

  if (order.substitutions.length === 0) return null;

  return (
    <section className="gap-gutter flex flex-col" aria-labelledby="substitutions-heading">
      <h2 id="substitutions-heading" className="text-text text-base font-semibold">
        {t('store.detail.replacements')}
      </h2>

      <ul className="border-outline-variant divide-outline-variant bg-surface divide-y rounded-lg border">
        {order.substitutions.map((substitution) => (
          <li key={substitution.id} className="gap-gutter p-gutter flex flex-wrap items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <p className="text-text">
                <span className="line-through">
                  <bdi>{substitution.original.productName}</bdi>
                </span>
                <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
                  {' → '}
                </span>
                <span className="font-medium">
                  <bdi>{substitution.replacement.productName}</bdi>
                </span>
                <Ltr>{' (× ' + substitution.replacement.quantity + ')'}</Ltr>
              </p>

              <p className="text-text-muted text-xs">
                {tx('store.detail.customerPays', {
                  amount: <Money>{formatPkr(substitution.chargedLineTotal)}</Money>,
                })}
                {substitution.storeAbsorbs > 0 ? (
                  <>
                    {' · '}
                    {tx('store.detail.storeAbsorbs', {
                      amount: <Money>{formatPkr(substitution.storeAbsorbs)}</Money>,
                    })}
                  </>
                ) : null}
              </p>

              {substitution.note ? (
                <p className="text-text-muted text-xs">
                  <bdi>{substitution.note}</bdi>
                </p>
              ) : null}
            </div>

            <div className="gap-tight flex shrink-0 flex-col items-end">
              <span
                className={
                  substitution.status === 'ACCEPTED'
                    ? 'text-success text-xs font-semibold'
                    : substitution.status === 'PROPOSED'
                      ? 'text-secondary text-xs font-semibold'
                      : 'text-text-muted text-xs font-semibold'
                }
              >
                {substitution.status === 'PROPOSED'
                  ? t('store.detail.waiting')
                  : substitution.status === 'ACCEPTED'
                    ? t('store.detail.accepted')
                    : substitution.status === 'REJECTED'
                      ? t('store.detail.declined')
                      : t('store.detail.withdrawn')}
              </span>

              {substitution.status === 'PROPOSED' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={cancel.isPending}
                  onClick={() => cancel.mutate(substitution.id)}
                >
                  {t('store.detail.withdraw')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
