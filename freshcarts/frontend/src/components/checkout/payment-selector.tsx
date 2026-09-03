'use client';

import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentMethods } from '@/features/checkout/checkout.hooks';
import type { FulfillmentMethod, PaymentMethod } from '@/types/order';

export interface PaymentSelectorProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  fulfillmentMethod: FulfillmentMethod;
  error?: string;
}

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  CASH_ON_DELIVERY: Banknote,
  CARD: CreditCard,
  MOBILE_WALLET: Smartphone,
};

/** When the shopper actually parts with the money — different for pickup. */
function describe(method: PaymentMethod, fulfillmentMethod: FulfillmentMethod): string {
  if (method === 'CASH_ON_DELIVERY') {
    return fulfillmentMethod === 'PICKUP'
      ? 'Pay in cash when you collect your order from the store.'
      : 'Pay the rider in cash when your order arrives.';
  }

  return 'Pay now, before your order is prepared.';
}

/**
 * Payment methods.
 *
 * The list comes from the API and nowhere else. §28's rule — a method must not
 * appear here merely because the enum contains it — is enforced by there being
 * no client-side list to fall back on: if the server does not return it, it
 * cannot be rendered.
 */
export function PaymentSelector({
  value,
  onChange,
  fulfillmentMethod,
  error,
}: PaymentSelectorProps) {
  const { data: methods, isPending } = usePaymentMethods();

  if (isPending) {
    return <Skeleton className="h-20 w-full" label="Loading payment methods" />;
  }

  if (!methods || methods.length === 0) {
    return (
      <p role="alert" className="bg-surface-muted p-gutter text-danger rounded-lg text-sm">
        No payment methods are available right now. Please try again shortly.
      </p>
    );
  }

  return (
    <RadioCardGroup
      label="How would you like to pay?"
      value={value}
      onChange={(next) => onChange(next as PaymentMethod)}
      error={error}
    >
      <div className="gap-tight flex flex-col">
        {methods.map((option) => {
          const Icon = METHOD_ICON[option.method];

          return (
            <RadioCard
              key={option.method}
              value={option.method}
              title={option.label}
              description={describe(option.method, fulfillmentMethod)}
              icon={<Icon className="size-5" />}
            />
          );
        })}
      </div>
    </RadioCardGroup>
  );
}
