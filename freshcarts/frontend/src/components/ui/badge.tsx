import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Every tone in the app, in one place.
 *
 * A pill is the app's most-repeated small component — discounts, stock,
 * order status, "Live"/"Hidden", payment state — and before this each of those
 * invented its own class string. One lookup means a status pill in the store
 * console and a discount badge on a product card cannot drift apart, and that
 * the semantic meaning of each colour is written down once.
 *
 * Tones are named for MEANING, not for colour, so a caller says `tone="sale"`
 * and the palette decision stays here.
 */
export type BadgeTone =
  'neutral' | 'brand' | 'fresh' | 'sale' | 'offer' | 'attention' | 'danger' | 'info' | 'berry';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text-muted',
  brand: 'bg-primary/10 text-primary',
  fresh: 'bg-leaf/12 text-success',
  sale: 'bg-tomato text-on-tomato',
  offer: 'bg-secondary-container text-on-secondary-container',
  attention: 'bg-apricot/25 text-attention',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-teal/12 text-info',
  berry: 'bg-berry/12 text-berry',
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  /** Decorative — the label always carries the meaning, never the icon alone. */
  icon?: ReactNode;
  className?: string;
}

export function Badge({ children, tone = 'neutral', size = 'sm', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * A price-tag shaped badge, used where a saving is the point.
 *
 * The notch on the leading edge is what makes it read as a shelf label rather
 * than one more rounded rectangle — the one place in the system that breaks the
 * pill shape on purpose (§9).
 */
export function TagBadge({
  children,
  tone = 'sale',
  className,
}: {
  children: ReactNode;
  tone?: 'sale' | 'offer';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 py-0.5 ps-2.5 pe-2 text-xs font-extrabold',
        'shadow-card rounded-s-sm rounded-e-full',
        tone === 'sale' ? 'bg-tomato text-on-tomato' : 'bg-apricot text-on-apricot',
        className,
      )}
    >
      {/* The punched hole of a paper tag. Decorative, so it is hidden. */}
      <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-current opacity-60" />
      {children}
    </span>
  );
}
