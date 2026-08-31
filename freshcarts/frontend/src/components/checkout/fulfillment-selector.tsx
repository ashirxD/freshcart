'use client';

import { Store, Truck } from 'lucide-react';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import type { FulfillmentMethod } from '@/types/order';

export interface FulfillmentSelectorProps {
  value: FulfillmentMethod;
  onChange: (method: FulfillmentMethod) => void;
}

/**
 * Delivery or pickup.
 *
 * Worded as a question a person would actually be asked, with no jargon:
 * "Delivery to your address", not "DELIVERY fulfilment method". The icons are
 * decorative — the text carries the meaning, because an icon alone is not a
 * label for anyone using a screen reader or unfamiliar with the convention.
 */
export function FulfillmentSelector({ value, onChange }: FulfillmentSelectorProps) {
  return (
    <RadioCardGroup
      label="How would you like to receive your order?"
      value={value}
      onChange={(next) => onChange(next as FulfillmentMethod)}
    >
      <div className="grid gap-xs sm:grid-cols-2">
        <RadioCard
          value="DELIVERY"
          title="Delivery"
          description="We bring it to your address. A delivery charge applies based on distance."
          icon={<Truck className="size-5" />}
        />
        <RadioCard
          value="PICKUP"
          title="Pickup"
          description="Collect it from the store yourself. No delivery charge."
          icon={<Store className="size-5" />}
        />
      </div>
    </RadioCardGroup>
  );
}
