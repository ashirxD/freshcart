'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/cn';
import type { Product } from '@/types/catalog';
import { ProductCard } from './product-card';
import { ProductCardSkeleton } from './product-grid';

export interface ProductRailProps {
  products: Product[];
  /** Labels the rail for assistive technology — "Today's deals", not "Rail". */
  label: string;
  className?: string;
}

/**
 * A horizontally scrolling shelf, used by the storefront sections.
 *
 * WHY ARROWS ON DESKTOP
 * Swiping is natural on a phone and impossible with a mouse. Without controls a
 * desktop shopper either drags a scrollbar or never discovers there is more on
 * the shelf, which is exactly the product-discovery problem the redesign is
 * meant to fix (§79). The buttons appear only where there is something to
 * scroll to, and only on pointer devices.
 *
 * The rail itself stays a native scroll container: real momentum, real
 * keyboard scrolling, real snap points, no JavaScript in the scroll path.
 */
export function ProductRail({ products, label, className }: ProductRailProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollOn, setCanScrollOn] = useState(false);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    // `scrollLeft` is negative in a right-to-left container, so both ends are
    // measured as distances rather than compared against zero directly.
    const start = Math.abs(track.scrollLeft);
    const max = track.scrollWidth - track.clientWidth;

    setCanScrollBack(start > 8);
    setCanScrollOn(start < max - 8);
  }, []);

  useEffect(() => {
    sync();

    const track = trackRef.current;
    if (!track) return;

    // The rail's own resize matters as much as the window's: a sidebar opening
    // can make a shelf that fitted no longer fit.
    const observer = new ResizeObserver(sync);
    observer.observe(track);

    return () => observer.disconnect();
  }, [sync, products.length]);

  const nudge = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    // Roughly one screen of cards, so a click feels like turning a page rather
    // than stepping one item at a time.
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={trackRef}
        onScroll={sync}
        aria-label={label}
        className={cn(
          'gap-snug sm:gap-gutter no-scrollbar flex snap-x snap-mandatory overflow-x-auto',
          // Bleeds to the screen edge on mobile so the rail reads as
          // scrollable, with padding that restores the page margin.
          '-mx-page px-page pb-2 md:-mx-8 md:px-8',
        )}
      >
        {products.map((product, index) => (
          <li key={product.id} className="w-[10.5rem] shrink-0 snap-start sm:w-48 lg:w-[13rem]">
            <ProductCard product={product} priority={index < 2} />
          </li>
        ))}
      </ul>

      {/*
        Pointer-only: on a touch device these would sit under the content the
        thumb is already able to swipe.

        Vertically they sit over the IMAGE band rather than the middle of the
        card. Centred on the rail they landed squarely on the product name and
        price of the first and last card, which is both ugly and a real target
        conflict — the arrow was covering the thing it was scrolling to.
      */}
      <div className="pointer-events-none absolute -start-3.5 -end-3.5 top-[26%] hidden items-center justify-between md:flex">
        <RailControl
          direction="back"
          disabled={!canScrollBack}
          label={'Scroll ' + label + ' backwards'}
          onClick={() => nudge(-1)}
        />
        <RailControl
          direction="on"
          disabled={!canScrollOn}
          label={'Scroll ' + label + ' forwards'}
          onClick={() => nudge(1)}
        />
      </div>
    </div>
  );
}

function RailControl({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: 'back' | 'on';
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === 'back' ? ChevronLeft : ChevronRight;

  return (
    <IconButton
      label={label}
      tone="floating"
      onClick={onClick}
      disabled={disabled}
      // Hidden from the tab order when there is nothing to scroll to, rather
      // than left as a focusable control that does nothing.
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        'ring-outline-variant pointer-events-auto ring-1 transition-opacity duration-200',
        disabled && 'pointer-events-none opacity-0',
      )}
    >
      <Icon className="size-5 rtl:rotate-180" aria-hidden="true" />
    </IconButton>
  );
}

/** Matches the rail's card widths so a loading shelf is the same height. */
export function ProductRailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="gap-snug sm:gap-gutter -mx-page px-page no-scrollbar flex overflow-hidden pb-2 md:-mx-8 md:px-8">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-[10.5rem] shrink-0 sm:w-48 lg:w-[13rem]">
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}
