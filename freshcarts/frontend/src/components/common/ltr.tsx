import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface LtrProps {
  children: ReactNode;
  className?: string;
  /** `bdi` by default: an isolating inline element, which is what bidi wants. */
  as?: ElementType;
}

/**
 * Content that must read left-to-right inside right-to-left text.
 *
 * Phone numbers, email addresses, order numbers, SKUs and prices are not
 * "English words" — they are things a shopper compares character by character,
 * and bidi will happily reorder them: "0300 1234567" can come out as
 * "1234567 0300", and "Rs. 340" can lose its dot to the wrong side. Giving them
 * `dir="ltr"` AND isolating them (`<bdi>`) fixes the order and stops them
 * influencing the words around them.
 *
 * It is INLINE on purpose. Putting `dir="ltr"` on the block that holds a price
 * would flip that block's `text-align: start/end` too, and a column of amounts
 * aligned to the end in an Urdu layout would suddenly align to the wrong side.
 * Wrapping just the characters leaves the block's own direction alone.
 */
export function Ltr({ children, className, as: Tag = 'bdi' }: LtrProps) {
  return (
    <Tag dir="ltr" className={className}>
      {children}
    </Tag>
  );
}

/** For prices, which also must not break across two lines. */
export function Money({ children, className }: { children: ReactNode; className?: string }) {
  return <Ltr className={cn('whitespace-nowrap', className)}>{children}</Ltr>;
}
