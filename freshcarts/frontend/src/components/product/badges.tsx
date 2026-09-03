import { TagBadge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { Stock } from '@/types/catalog';

/**
 * The saving on a discounted product.
 *
 * Shaped like a paper shelf tag rather than a pill — the one deliberate break
 * from the app's pill shapes (§9), because a saving is the one thing on a card
 * that should look like it came from the shop and not from the interface.
 *
 * `discountPercent` is computed by the API — this never divides prices itself,
 * so the badge and the cart can never disagree about the size of a discount.
 */
export function DiscountBadge({
  discountPercent,
  className,
}: {
  discountPercent: number;
  className?: string;
}) {
  if (discountPercent <= 0) return null;

  return <TagBadge className={className}>{discountPercent}% off</TagBadge>;
}

/**
 * Availability, in three ways at once: a coloured dot, a colour, and a word.
 *
 * Colour alone would fail anyone with a colour-vision deficiency and anyone in
 * a high-contrast mode, so the sentence is what actually carries the meaning
 * and the dot gives it a shape to recognise at a glance in a dense grid.
 */
const AVAILABILITY = {
  IN_STOCK: { label: 'In stock', ink: 'text-success', dot: 'bg-leaf' },
  LOW_STOCK: { ink: 'text-attention', dot: 'bg-apricot' },
  OUT_OF_STOCK: { label: 'Out of stock', ink: 'text-danger', dot: 'bg-danger' },
} as const;

/**
 * The exact quantity is operational information; "Only 3 left" is what actually
 * helps a shopper decide, and it avoids exposing inventory levels publicly.
 */
export function AvailabilityBadge({ stock, className }: { stock: Stock; className?: string }) {
  const style = AVAILABILITY[stock.status];
  const label = 'label' in style ? style.label : 'Only ' + stock.quantity + ' left';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[0.6875rem] font-semibold whitespace-nowrap',
        style.ink,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
      {label}
    </span>
  );
}
