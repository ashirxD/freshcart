'use client';

import type { ReactNode } from 'react';
import { Phone, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Ltr } from '@/components/common/ltr';
import { useI18n, useT, type TranslationKey } from '@/i18n';
import { formatPkr } from '@/lib/format';
import { OrderSummaryPanel, formatDistance } from './order-summary-panel';
import type { CheckoutPreview, FulfillmentMethod } from '@/types/order';

export interface ReviewStepProps {
  fulfillmentMethod: FulfillmentMethod;
  preview: CheckoutPreview | null;
  customerNote: string;
  onEditAddress: () => void;
  onEditPayment: () => void;
}

/**
 * The last read-through before anything is committed.
 *
 * Every §43 item is here — items, quantities, prices, subtotal, fulfilment,
 * address or pickup location, delivery charge, payment method, total — and each
 * block that represents a decision carries a way back to the step that made it,
 * so the shopper is never trapped at the end of the flow.
 *
 * The numbers are the server's preview, unmodified. Nothing on this screen adds
 * anything up.
 */
export function ReviewStep({
  fulfillmentMethod,
  preview,
  customerNote,
  onEditAddress,
  onEditPayment,
}: ReviewStepProps) {
  const { t, tx } = useI18n();

  if (!preview) {
    return <Skeleton className="h-64 w-full" label={t('checkout.review.loading')} />;
  }

  const paymentLabel = t(
    ('checkout.payment.method.' +
      (preview.selectedPaymentMethod ?? 'CASH_ON_DELIVERY')) as TranslationKey,
  );

  return (
    <section aria-labelledby="review-heading" className="gap-loose flex flex-col">
      <h2 id="review-heading" className="text-text text-base font-bold tracking-[-0.015em]">
        {t('checkout.review.title')}
      </h2>

      {fulfillmentMethod === 'DELIVERY' && preview.delivery ? (
        <ReviewBlock
          title={t('checkout.review.deliveringTo')}
          onEdit={onEditAddress}
          editLabel={t('checkout.review.changeAddress')}
        >
          <p className="text-text font-medium">
            <bdi>{preview.delivery.address.recipientName}</bdi>
          </p>
          <p className="text-text-muted">
            <bdi>{preview.delivery.address.formatted}</bdi>
          </p>
          <p className="text-text-muted flex items-center gap-1.5">
            <Phone className="size-3.5" aria-hidden="true" />
            <Ltr>{preview.delivery.address.phone}</Ltr>
          </p>
          <p className="text-text-muted mt-1">
            {tx('checkout.review.fromStore', {
              distance: <Ltr>{formatDistance(preview.delivery.distanceMeters, t)}</Ltr>,
              fee: (
                <Ltr className="text-text font-medium whitespace-nowrap">
                  {formatPkr(preview.delivery.fee)}
                </Ltr>
              ),
            })}
          </p>
        </ReviewBlock>
      ) : null}

      {fulfillmentMethod === 'PICKUP' && preview.pickup ? (
        <ReviewBlock title={t('checkout.review.collectingFrom')}>
          <p className="text-text flex items-center gap-1.5 font-medium">
            <Store className="size-4" aria-hidden="true" />
            <bdi>{preview.pickup.storeName}</bdi>
          </p>
          <p className="text-text-muted">
            <bdi>{preview.pickup.storeAddress}</bdi>
          </p>
          <p className="text-text-muted flex items-center gap-1.5">
            <Phone className="size-3.5" aria-hidden="true" />
            <Ltr>{preview.pickup.storePhone}</Ltr>
          </p>
          {preview.pickup.instructions ? (
            <p className="text-text-muted mt-1">{preview.pickup.instructions}</p>
          ) : null}
        </ReviewBlock>
      ) : null}

      <ReviewBlock
        title={t('checkout.review.payingWith')}
        onEdit={onEditPayment}
        editLabel={t('checkout.review.changePayment')}
      >
        <p className="text-text font-medium">{paymentLabel}</p>
      </ReviewBlock>

      {customerNote.trim() ? (
        <ReviewBlock title={t('checkout.review.yourNote')}>
          <p className="text-text-muted">
            <bdi>{customerNote.trim()}</bdi>
          </p>
        </ReviewBlock>
      ) : null}

      {/*
        The itemised list. Shown here on mobile, where the sidebar summary is
        below the fold — on desktop the sticky sidebar already carries it, and
        two copies on one screen would be noise.
      */}
      <OrderSummaryPanel preview={preview} className="lg:hidden" />
    </section>
  );
}

function ReviewBlock({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <div className="gap-tight ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-xl ring-1">
      <div className="gap-gutter flex items-center justify-between">
        <h3 className="text-eyebrow text-text-muted uppercase">{title}</h3>

        {onEdit ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {editLabel ?? t('checkout.review.change')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5 text-sm">{children}</div>
    </div>
  );
}
