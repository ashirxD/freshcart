'use client';

import { Money } from '@/components/common/ltr';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr, formatPkrLabel } from '@/lib/format';

export interface PriceDisplayProps {
  sellingPrice: number;
  compareAtPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * The price sizes come from the type scale, not from body text.
 *
 * A price is the second thing a shopper reads after the product name, and on
 * the old card it was set at the same size and weight as the pack label — so
 * nothing on the card had emphasis (§27, §81). Here it is heavier and tighter
 * than everything around it at every size.
 */
const PRICE_SIZES = {
  sm: 'text-[0.9375rem]',
  md: 'text-price',
  lg: 'text-price-lg',
} as const;

const WAS_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
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
  const t = useT();
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > sellingPrice);

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5', className)}>
      <span
        className={cn(
          'text-text font-extrabold tracking-[-0.02em] tabular-nums',
          PRICE_SIZES[size],
        )}
        aria-label={
          hasDiscount
            ? t('product.priceNow', { amount: formatPkrLabel(sellingPrice, t) })
            : formatPkrLabel(sellingPrice, t)
        }
      >
        <Money>{formatPkr(sellingPrice)}</Money>
      </span>

      {hasDiscount && compareAtPrice ? (
        <s
          className={cn('text-text-muted font-medium tabular-nums', WAS_SIZES[size])}
          aria-label={t('product.priceWas', { amount: formatPkrLabel(compareAtPrice, t) })}
        >
          <Money>{formatPkr(compareAtPrice)}</Money>
        </s>
      ) : null}
    </p>
  );
}
