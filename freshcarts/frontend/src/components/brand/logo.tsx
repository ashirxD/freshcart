import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface BrandMarkProps {
  className?: string;
}

/**
 * The FreshCarts mark: a paper grocery bag with two leaves sprouting from it.
 *
 * Drawn rather than imported so it inherits `currentColor` and stays crisp at
 * every size — the same three shapes have to read at 16px in a browser tab and
 * at 40px in the header, which is why there is no fine detail in it.
 *
 * The bag tapers the way a filled paper bag does, and the leaves sit where the
 * handles would be: the whole idea of the product — fresh things, carried home
 * — in one silhouette.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      {/* The bag. Filled, so the mark holds together as one object at small sizes. */}
      <path
        d="M5.3 8.4h13.4c.78 0 1.39.68 1.3 1.45l-1.05 8.6A3 3 0 0 1 15.97 21H8.03a3 3 0 0 1-2.98-2.55L4 9.85c-.09-.77.52-1.45 1.3-1.45Z"
        fill="currentColor"
      />
      {/* The bag's fold, cut out of the fill so it reads as a crease, not a line. */}
      <path
        d="M7.6 11.2h8.8"
        stroke="var(--color-cream)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Right leaf. */}
      <path
        d="M12.6 8.1c.05-2.5 1.72-4.5 4.4-4.9.28 2.9-1.5 4.8-4.4 4.9Z"
        fill="currentColor"
      />
      {/* Left leaf, slightly smaller so the pair is not a mirror. */}
      <path
        d="M11.4 8.1C11.3 6 10 4.3 7.9 3.7c-.2 2.5 1.1 4.3 3.5 4.4Z"
        fill="currentColor"
      />
      {/* Stem: the one stroke that stops the leaves floating. */}
      <path
        d="M12 8.4V5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface LogoProps {
  /** `onDark` inverts the mark for the footer and other deep-green grounds. */
  tone?: 'default' | 'onDark';
  size?: 'sm' | 'md' | 'lg';
  /** Renders the mark alone — for a compact header or a narrow bar. */
  markOnly?: boolean;
  className?: string;
}

const TILE_SIZES = {
  sm: 'size-8 rounded-md',
  md: 'size-9 rounded-lg',
  lg: 'size-11 rounded-xl',
} as const;

const MARK_SIZES = {
  sm: 'size-5',
  md: 'size-5.5',
  lg: 'size-7',
} as const;

const WORD_SIZES = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

/**
 * The lock-up: mark in a tinted tile, wordmark beside it.
 *
 * The tile is what gives the brand presence in a header without needing a
 * larger logo — a bare wordmark in green is what made the old navigation read
 * as an admin tool.
 */
export function Logo({ tone = 'default', size = 'md', markOnly = false, className }: LogoProps) {
  const onDark = tone === 'onDark';

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center',
          TILE_SIZES[size],
          onDark ? 'bg-cream text-primary' : 'bg-primary text-cream',
        )}
      >
        <BrandMark className={MARK_SIZES[size]} />
      </span>

      {!markOnly ? (
        <span
          className={cn(
            'font-extrabold tracking-[-0.03em]',
            WORD_SIZES[size],
            onDark ? 'text-cream' : 'text-primary',
          )}
        >
          Fresh<span className={onDark ? 'text-apricot' : 'text-leaf'}>Carts</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * The header logo as a link home.
 *
 * Its accessible name is "FreshCarts, home" rather than the two words a screen
 * reader would otherwise read out of the split wordmark ("Fresh", "Carts").
 */
export function LogoLink({
  tone = 'default',
  size = 'md',
  markOnly = false,
  className,
}: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="FreshCarts, home"
      className={cn('group flex shrink-0 items-center', className)}
    >
      <Logo
        tone={tone}
        size={size}
        markOnly={markOnly}
        // A restrained press response: the whole lock-up settles by 1px.
        className="transition-transform duration-150 ease-standard group-active:translate-y-px"
      />
    </Link>
  );
}
