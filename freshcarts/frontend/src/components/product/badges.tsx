import { cn } from '@/lib/cn';
import type { Stock } from '@/types/catalog';

/**
 * The saving on a discounted product.
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

  return (
    <span
      className={cn(
        'bg-secondary-container inline-flex items-center rounded-full px-2 py-0.5',
        'text-on-secondary-container text-xs font-bold',
        className,
      )}
    >
      {discountPercent}% off
    </span>
  );
}

const AVAILABILITY_STYLES = {
  IN_STOCK: 'text-success',
  LOW_STOCK: 'text-secondary',
  OUT_OF_STOCK: 'text-danger',
} as const;

/**
 * Availability in plain words rather than a stock count.
 *
 * The exact quantity is operational information; "Only 3 left" is what actually
 * helps a shopper decide, and it avoids exposing inventory levels publicly.
 */
export function AvailabilityBadge({ stock, className }: { stock: Stock; className?: string }) {
  const label =
    stock.status === 'OUT_OF_STOCK'
      ? 'Out of stock'
      : stock.status === 'LOW_STOCK'
        ? 'Only ' + stock.quantity + ' left'
        : 'Available now';

  return (
    <span className={cn('text-xs font-medium', AVAILABILITY_STYLES[stock.status], className)}>
      {label}
    </span>
  );
}
