import { cn } from '@/lib/cn';
import { formatPkr, formatPkrLabel } from '@/lib/format';

export interface PriceDisplayProps {
  sellingPrice: number;
  compareAtPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PRICE_SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
} as const;

/**
 * The current price, with the previous one struck through when there is a real
 * discount.
 *
 * The two prices are wrapped in a labelled group because a bare "Rs. 380
 * Rs. 340" is ambiguous read aloud — the labels make it unmistakable which
 * number the shopper pays.
 */
export function PriceDisplay({
  sellingPrice,
  compareAtPrice,
  size = 'md',
  className,
}: PriceDisplayProps) {
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > sellingPrice);

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span
        className={cn('text-text font-bold tracking-tight tabular-nums', PRICE_SIZES[size])}
        aria-label={(hasDiscount ? 'Now ' : '') + formatPkrLabel(sellingPrice)}
      >
        {formatPkr(sellingPrice)}
      </span>

      {hasDiscount && compareAtPrice ? (
        <s
          className="text-text-muted text-sm tabular-nums"
          aria-label={'Was ' + formatPkrLabel(compareAtPrice)}
        >
          {formatPkr(compareAtPrice)}
        </s>
      ) : null}
    </p>
  );
}
