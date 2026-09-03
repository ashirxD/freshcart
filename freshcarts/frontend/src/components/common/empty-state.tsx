import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** A lucide icon, sized by this component. Sits inside a tinted tile. */
  icon?: ReactNode;
  action?: ReactNode;
  /** Reserved for the few places that warrant a drawn illustration. */
  illustration?: ReactNode;
  className?: string;
}

/**
 * Shown instead of a blank screen. Always pairs the explanation with a next
 * step, so a shopper is never left wondering what to do.
 *
 * Kept deliberately compact (§48): an empty basket does not need half the
 * viewport to say so, and a huge empty state is just a different kind of empty
 * page. The icon sits in a soft tile with a ring rather than a flat circle, so
 * it reads as a considered mark instead of a missing image.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  illustration,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('gap-gutter px-page py-wide flex flex-col items-center text-center', className)}
    >
      {illustration ?? null}

      {icon && !illustration ? (
        <div
          className={cn(
            'bg-cream text-primary ring-sand flex size-16 items-center justify-center',
            'rounded-2xl ring-1 [&>svg]:size-7',
          )}
        >
          {icon}
        </div>
      ) : null}

      <div className="gap-tight flex flex-col">
        <h3 className="text-text text-lg font-bold tracking-[-0.02em]">{title}</h3>
        {description ? (
          <p className="text-text-muted max-w-sm text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

/**
 * An empty paper grocery bag.
 *
 * Used where the emptiness IS the message — a basket with nothing in it, a
 * saved list with nothing saved. One shape, two tones, no gradient: it has to
 * survive next to real product photography without competing with it.
 */
export function EmptyBasketIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden="true" className={cn('h-24 w-30', className)}>
      {/* The shadow the bag casts on the shelf — grounds the drawing. */}
      <ellipse cx="60" cy="86" rx="34" ry="5" fill="var(--color-sand)" opacity="0.7" />

      {/* Bag body. */}
      <path
        d="M26 30h68a4 4 0 0 1 3.98 4.45l-5.2 44A8 8 0 0 1 84.83 86H35.17a8 8 0 0 1-7.95-7.55l-5.2-44A4 4 0 0 1 26 30Z"
        fill="var(--color-cream)"
        stroke="var(--color-sand)"
        strokeWidth="2.5"
      />

      {/* The fold across the top of the bag. */}
      <path d="M23 42h74" stroke="var(--color-sand)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Handles. */}
      <path
        d="M42 30V22a18 18 0 0 1 36 0v8"
        stroke="var(--color-sand)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* One leaf left in the bottom — the reason to fill it. */}
      <path
        d="M60 72c-.1-5.6 3.4-10.2 9.4-11.3.6 6.6-3.2 10.9-9.4 11.3Z"
        fill="var(--color-leaf)"
        opacity="0.55"
      />
    </svg>
  );
}
