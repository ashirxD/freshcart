import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  /** Screen-reader label for the region being loaded. */
  label?: string;
}

/**
 * Loading placeholder. Shaped by the caller via className so a skeleton always
 * matches the real content it replaces and the layout does not jump.
 */
export function Skeleton({ className, label }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn('animate-pulse rounded-md bg-surface-sunken', className)}
    />
  );
}

/** Convenience for multi-line text placeholders. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}
