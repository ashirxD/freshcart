'use client';

import { Store, Truck } from 'lucide-react';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { Badge } from '@/components/ui/badge';
import type { FulfillmentMethod } from '@/types/order';

export interface FulfillmentSelectorProps {
  value: FulfillmentMethod;
  onChange: (method: FulfillmentMethod) => void;
}

/**
 * Delivery or pickup (§36).
 *
 * Worded as a question a person would actually be asked, with no jargon:
 * "We bring it to your address", not "DELIVERY fulfilment method". The icons
 * are decorative — the text carries the meaning, because an icon alone is not a
 * label for anyone using a screen reader or unfamiliar with the convention.
 *
 * THE COST IS ON THE CARD
 * Each option states its charge before it is chosen: delivery says the fee
 * depends on distance and is shown before the order, pickup says there is no
 * charge. §36 is explicit that delivery costs must not be hidden until the last
 * step, and this is the first moment either can honestly be described — the
 * actual figure needs an address, which is the very next step.
 */
export function FulfillmentSelector({ value, onChange }: FulfillmentSelectorProps) {
  return (
    <RadioCardGroup
      label="How would you like to get your order?"
      value={value}
      onChange={(next) => onChange(next as FulfillmentMethod)}
    >
      <div className="gap-snug grid sm:grid-cols-2">
        <RadioCard
          value="DELIVERY"
          title="Delivered to you"
          description="A rider brings it to your address."
          icon={<Truck className="size-5" />}
          trailing={<Badge tone="attention">Charge by distance</Badge>}
        >
          <span className="text-text-muted mt-1.5 block text-xs">
            Worked out from the road distance to your address, and shown to you before you place the
            order.
          </span>
        </RadioCard>

        <RadioCard
          value="PICKUP"
          title="Collect in store"
          description="We pack it and hold it for you."
          icon={<Store className="size-5" />}
          trailing={<Badge tone="fresh">No charge</Badge>}
        >
          <span className="text-text-muted mt-1.5 block text-xs">
            Bring your order number to the counter. Nothing extra to pay for delivery.
          </span>
        </RadioCard>
      </div>
    </RadioCardGroup>
  );
}
