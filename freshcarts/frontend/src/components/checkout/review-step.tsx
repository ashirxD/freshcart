'use client';

import type { ReactNode } from 'react';
import { Phone, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  if (!preview) {
    return <Skeleton className="h-64 w-full" label="Loading your order" />;
  }

  const paymentLabel =
    preview.paymentMethods.find((option) => option.method === preview.selectedPaymentMethod)
      ?.label ?? 'Cash on delivery';

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-lg">
      <h2 id="review-heading" className="text-base font-semibold text-text">
        Review your order
      </h2>

      {fulfillmentMethod === 'DELIVERY' && preview.delivery ? (
        <ReviewBlock title="Delivering to" onEdit={onEditAddress} editLabel="Change address">
          <p className="font-medium text-text">{preview.delivery.address.recipientName}</p>
          <p className="text-text-muted">{preview.delivery.address.formatted}</p>
          <p className="flex items-center gap-1.5 text-text-muted">
            <Phone className="size-3.5" aria-hidden="true" />
            {preview.delivery.address.phone}
          </p>
          <p className="mt-1 text-text-muted">
            {formatDistance(preview.delivery.distanceMeters)} from the store ·{' '}
            <span className="font-medium text-text">{formatPkr(preview.delivery.fee)}</span>{' '}
            delivery charge
          </p>
        </ReviewBlock>
      ) : null}

      {fulfillmentMethod === 'PICKUP' && preview.pickup ? (
        <ReviewBlock title="Collecting from">
          <p className="flex items-center gap-1.5 font-medium text-text">
            <Store className="size-4" aria-hidden="true" />
            {preview.pickup.storeName}
          </p>
          <p className="text-text-muted">{preview.pickup.storeAddress}</p>
          <p className="flex items-center gap-1.5 text-text-muted">
            <Phone className="size-3.5" aria-hidden="true" />
            {preview.pickup.storePhone}
          </p>
          {preview.pickup.instructions ? (
            <p className="mt-1 text-text-muted">{preview.pickup.instructions}</p>
          ) : null}
        </ReviewBlock>
      ) : null}

      <ReviewBlock title="Paying with" onEdit={onEditPayment} editLabel="Change payment">
        <p className="font-medium text-text">{paymentLabel}</p>
      </ReviewBlock>

      {customerNote.trim() ? (
        <ReviewBlock title="Your note">
          <p className="text-text-muted">{customerNote.trim()}</p>
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
  return (
    <div className="flex flex-col gap-xs rounded-lg border border-outline-variant bg-surface p-gutter">
      <div className="flex items-center justify-between gap-gutter">
        <h3 className="text-sm font-semibold tracking-wide text-text-muted uppercase">{title}</h3>

        {onEdit ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {editLabel ?? 'Change'}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5 text-sm">{children}</div>
    </div>
  );
}
