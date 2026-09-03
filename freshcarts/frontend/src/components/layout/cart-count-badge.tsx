'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatBadgeCount } from '@/lib/format';

export interface CartCountBadgeProps {
  count: number;
  className?: string;
}

/**
 * The number on the basket.
 *
 * It gives one 1.22× beat when the count GOES UP, and nothing when it goes down
 * (§34). That asymmetry is the point: a shopper needs confirmation that the tap
 * they just made landed somewhere, and no celebration at all for removing
 * something. The nav bar itself never moves — only the badge — because a header
 * that jumps on every add is unusable on a shopping run.
 *
 * The beat is driven by a key that changes on increase, so the animation
 * restarts reliably for a rapid sequence of adds rather than being swallowed
 * because the element is already mid-animation.
 */
export function CartCountBadge({ count, className }: CartCountBadgeProps) {
  const previous = useRef(count);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (count > previous.current) setBeat((value) => value + 1);
    previous.current = count;
  }, [count]);

  if (count <= 0) return null;

  return (
    <span
      key={beat}
      // The count is already in the control's accessible label ("Basket, 3
      // items"), so announcing it again here would double it up.
      aria-hidden="true"
      className={cn(
        'bg-apricot text-on-apricot ring-surface animate-nudge',
        'absolute flex min-w-[1.125rem] items-center justify-center rounded-full',
        'px-1 text-[0.625rem] leading-4 font-extrabold tabular-nums ring-2',
        className,
      )}
    >
      {formatBadgeCount(count)}
    </span>
  );
}
