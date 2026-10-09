'use client';

import { Store, Truck } from 'lucide-react';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
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
  const t = useT();

  return (
    <RadioCardGroup
      label={t('checkout.fulfillment.question')}
      value={value}
      onChange={(next) => onChange(next as FulfillmentMethod)}
    >
      <div className="gap-snug grid sm:grid-cols-2">
        <RadioCard
          value="DELIVERY"
          title={t('checkout.fulfillment.deliveryTitle')}
          description={t('checkout.fulfillment.deliveryDesc')}
          icon={<Truck className="size-5" />}
          trailing={<Badge tone="attention">{t('checkout.fulfillment.deliveryBadge')}</Badge>}
        >
          <span className="text-text-muted mt-1.5 block text-xs">
            {t('checkout.fulfillment.deliveryNote')}
          </span>
        </RadioCard>

        <RadioCard
          value="PICKUP"
          title={t('checkout.fulfillment.pickupTitle')}
          description={t('checkout.fulfillment.pickupDesc')}
          icon={<Store className="size-5" />}
          trailing={<Badge tone="fresh">{t('checkout.fulfillment.pickupBadge')}</Badge>}
        >
          <span className="text-text-muted mt-1.5 block text-xs">
            {t('checkout.fulfillment.pickupNote')}
          </span>
        </RadioCard>
      </div>
    </RadioCardGroup>
  );
}
