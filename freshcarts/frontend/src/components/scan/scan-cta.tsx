'use client';

import { ScanLine } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useScanAvailability } from '@/features/scan/scan.hooks';

export interface ScanCtaProps {
  /** `banner` for the home screen; `inline` for a quieter spot such as the cart. */
  variant?: 'banner' | 'inline';
  className?: string;
}

/**
 * The way into the scanner (§2).
 *
 * It hides itself when the AI service is unavailable. That is the point of the
 * availability probe: inviting somebody to photograph their shopping list and
 * only then telling them we cannot read it is a worse experience than never
 * offering it (§37). While the probe is in flight nothing is shown either, so
 * the button never appears and then vanishes under a thumb.
 */
export function ScanCta({ variant = 'banner', className }: ScanCtaProps) {
  const { data } = useScanAvailability();

  if (!data?.available) return null;

  if (variant === 'inline') {
    return (
      <Link
        href="/scan"
        className={cn(
          'text-primary gap-xs min-h-touch flex items-center justify-center rounded-full text-sm font-medium',
          'hover:bg-surface-muted px-gutter',
          className,
        )}
      >
        <ScanLine className="size-4" aria-hidden="true" />
        Scan a grocery list instead
      </Link>
    );
  }

  return (
    <Link
      href="/scan"
      className={cn(
        'bg-primary text-on-primary gap-gutter p-gutter min-h-touch flex items-center rounded-lg',
        'hover:bg-primary-container transition-colors',
        className,
      )}
    >
      <span
        className="bg-on-primary/15 flex size-11 shrink-0 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <ScanLine className="size-6" />
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-base font-semibold">Scan Grocery List</span>
        {/* The promise §79 asks for, in the shopper's terms rather than ours. */}
        <span className="text-on-primary/85 text-sm">
          Take a picture of your list and we&rsquo;ll do the boring work
        </span>
      </span>
    </Link>
  );
}
