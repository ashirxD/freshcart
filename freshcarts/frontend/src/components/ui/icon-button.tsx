'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The circular icon control used across the app chrome: header actions, close
 * buttons, gallery arrows, card overlays.
 *
 * It exists because the same eight classes were being retyped at every call
 * site, and a couple of them had quietly drifted below the 48px target. Here
 * `md` IS the touch target, and `sm` is only permitted where the control sits
 * inside something already tappable.
 *
 * An icon carries no accessible name, so `label` is required — it becomes
 * `aria-label`, and the icon itself is always hidden from the reading order.
 */
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** What the control does, e.g. "Clear search". Required, never decorative. */
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md';
  /** `floating` sits over imagery; `solid` is used on tinted bars. */
  tone?: 'plain' | 'floating' | 'solid';
}

const SIZES = {
  sm: 'size-9',
  md: 'size-touch',
} as const;

const TONES = {
  plain: 'text-text hover:bg-primary/8 active:bg-primary/12',
  floating: 'bg-surface/90 text-text shadow-card backdrop-blur-[2px] hover:bg-surface',
  solid: 'bg-surface-muted text-primary hover:bg-sand',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, size = 'md', tone = 'plain', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        'ease-standard transition-[background-color,color,box-shadow,transform] duration-150',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-45',
        SIZES[size],
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export interface IconLinkProps {
  href: string;
  /** What the destination is, e.g. "Saved items". Required. */
  label: string;
  children: ReactNode;
  /** Renders the current-page treatment and sets `aria-current`. */
  isCurrent?: boolean;
  className?: string;
}

/** The navigation counterpart: an anchor, styled as an icon control. */
export function IconLink({ href, label, children, isCurrent, className }: IconLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        'size-touch relative flex shrink-0 items-center justify-center rounded-full',
        'ease-standard transition-[background-color,color,transform] duration-150 active:scale-95',
        isCurrent ? 'bg-primary/10 text-primary' : 'text-text hover:bg-primary/8',
        className,
      )}
    >
      {children}
    </Link>
  );
}
