'use client';

import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentStore } from '@/features/catalog/catalog.hooks';
import { cn } from '@/lib/cn';

export interface StoreLocationProps {
  /**
   * `chip` is the compact form for a header; `line` is the two-line form used
   * where there is room to say what the shopper is looking at.
   */
  variant?: 'chip' | 'line';
  /** Inverts for the deep-green utility strip. */
  tone?: 'default' | 'onDark';
  className?: string;
}

/**
 * Which shop is serving this shopper (§14).
 *
 * On a grocery service this is not decoration: it is the answer to "will you
 * come to me", and it sets the expectation for the delivery charge that turns
 * up at checkout. FreshCarts serves one store at a time, so this states the
 * fact rather than pretending to be a picker — a dropdown with one option in it
 * is a worse experience than a clear label.
 *
 * It is small on purpose. The old screen gave the same information a full line
 * of body copy under the greeting; this says it in a chip and gives the space
 * back to the groceries.
 */
export function StoreLocation({
  variant = 'chip',
  tone = 'default',
  className,
}: StoreLocationProps) {
  const { data: store, isPending } = useCurrentStore();
  const onDark = tone === 'onDark';

  if (isPending) {
    return (
      <Skeleton
        className={cn('h-5 w-40', onDark && 'bg-cream/20', className)}
        label="Loading store details"
      />
    );
  }

  // Nothing at all rather than a placeholder: the header must not claim a
  // location the API could not confirm.
  if (!store) return null;

  if (variant === 'line') {
    return (
      <p className={cn('flex items-start gap-1.5 text-sm', className)}>
        <MapPin
          className={cn('mt-0.5 size-4 shrink-0', onDark ? 'text-apricot' : 'text-leaf')}
          aria-hidden="true"
        />
        <span className={onDark ? 'text-cream/85' : 'text-text-muted'}>
          Delivering from{' '}
          <span className={cn('font-semibold', onDark ? 'text-cream' : 'text-text')}>
            {store.name}
          </span>
          , {store.address.area}
        </span>
      </p>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-full py-1 ps-1.5 pe-2.5',
        onDark ? 'bg-cream/12 text-cream' : 'bg-leaf/10 text-primary',
        className,
      )}
    >
      <MapPin
        className={cn('size-3.5 shrink-0', onDark ? 'text-apricot' : 'text-leaf')}
        aria-hidden="true"
      />
      <span className="truncate text-xs font-semibold">
        {/*
          "Delivering to" is dropped on a narrow phone. With it, a 375px header
          truncated the chip to "Delivering to Sa…" — the prefix survived and
          the one word that matters, the area, did not.
        */}
        <span
          className={cn(
            'hidden font-medium sm:inline',
            onDark ? 'text-cream/70' : 'text-text-muted',
          )}
        >
          Delivering to{' '}
        </span>
        {store.address.area}
      </span>
    </span>
  );
}
