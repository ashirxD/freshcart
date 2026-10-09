'use client';

import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  /** Screen-reader label for the region being loaded. */
  label?: string;
}

/**
 * Loading placeholder. Shaped by the caller via className so a skeleton always
 * matches the real content it replaces and the layout does not jump.
 *
 * The fill is a warm tonal sheen rather than a pulsing grey block: a grey
 * rectangle on a cream page announces "this is a template", and a slow sweep
 * reads as work in progress without the flashing of an opacity pulse.
 */
export function Skeleton({ className, label }: SkeletonProps) {
  const t = useT();

  return (
    <div
      role="status"
      aria-label={label ?? t('states.loading')}
      className={cn('skeleton-sheen rounded-md', className)}
    />
  );
}

/** Convenience for multi-line text placeholders. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('gap-tight flex flex-col', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
