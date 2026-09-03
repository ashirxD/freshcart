'use client';

import Link from 'next/link';
import { ArrowRight, Camera, ScanLine } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useScanAvailability } from '@/features/scan/scan.hooks';

export interface ScanCtaProps {
  /** `banner` for a prominent spot; `inline` for a quieter one such as the basket. */
  variant?: 'banner' | 'inline';
  className?: string;
}

/**
 * The way into the scanner.
 *
 * It hides itself when the AI service is unavailable. That is the point of the
 * availability probe: inviting somebody to photograph their shopping list and
 * only then telling them we cannot read it is a worse experience than never
 * offering it. While the probe is in flight nothing is shown either, so the
 * button never appears and then vanishes under a thumb.
 *
 * The storefront has a full section for this feature (ScanFeature); this is the
 * compact form used where the feature is a helpful aside rather than the
 * subject — an empty basket, for instance, which is exactly when a written list
 * is in somebody's pocket.
 */
export function ScanCta({ variant = 'banner', className }: ScanCtaProps) {
  const { data } = useScanAvailability();

  if (!data?.available) return null;

  if (variant === 'inline') {
    return (
      <Link
        href="/scan"
        className={cn(
          'text-primary gap-tight min-h-touch px-gutter flex items-center justify-center rounded-full text-sm font-semibold',
          'hover:bg-primary/8 transition-colors',
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
        'group bg-peach/45 ring-apricot/40 gap-gutter p-gutter flex items-center rounded-2xl ring-1',
        'ease-standard transition-[background-color,box-shadow] duration-200',
        'hover:bg-peach/60 hover:shadow-card',
        className,
      )}
    >
      <span
        className="bg-surface/80 text-attention flex size-12 shrink-0 items-center justify-center rounded-xl"
        aria-hidden="true"
      >
        <Camera className="size-6" />
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-text text-card">Have a grocery list?</span>
        {/* The promise in the shopper's terms rather than ours. */}
        <span className="text-text-muted text-sm">
          Take a photo and we will build the basket for you.
        </span>
      </span>

      <ArrowRight
        className="text-attention ease-standard ms-auto size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180"
        aria-hidden="true"
      />
    </Link>
  );
}
