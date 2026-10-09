'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

export interface StatTileProps {
  label: string;
  value: number;
  /** Filters the destination list to exactly what the number counts. */
  href?: string;
  /** ATTENTION raises the tile visually; it is not decoration. */
  tone?: 'DEFAULT' | 'ATTENTION' | 'WARNING' | 'DANGER';
  className?: string;
}

/**
 * Tone carries meaning, so it is never colour alone.
 *
 * A raised tile also gets a heavier border and heavier type, which is what keeps
 * it legible in a high-contrast mode and to anyone with a colour-vision
 * deficiency — the same rule the order status badge follows.
 */
/**
 * The store console's status palette (§73, §74).
 *
 * ATTENTION is the tile a manager should look at first — orders waiting to be
 * accepted — so it takes the apricot that means "someone is waiting on you"
 * everywhere else in the app. WARNING is stock running down, DANGER is
 * something out of stock, and DEFAULT is a number that is merely true.
 */
const TONES = {
  DEFAULT: 'ring-outline-variant bg-surface text-text',
  ATTENTION: 'ring-apricot/50 bg-apricot/15 text-attention',
  WARNING: 'ring-berry/30 bg-berry/8 text-berry',
  DANGER: 'ring-danger/35 bg-danger/6 text-danger',
} as const;

/**
 * One number on the operations dashboard.
 *
 * Every tile is a link to the list that number came from: a count nobody can act
 * on is decoration, and §59 asks for exactly this — "7 products are low in
 * stock" with a way through to them.
 */
export function StatTile({ label, value, href, tone = 'DEFAULT', className }: StatTileProps) {
  const t = useT();

  const body = (
    <>
      <span className="text-3xl leading-none font-extrabold tracking-[-0.03em] tabular-nums">
        {value}
      </span>
      <span className="text-sm leading-snug font-semibold">{label}</span>
      {href ? (
        <span className="text-text-muted mt-auto flex items-center gap-0.5 text-xs">
          {t('store.dashboard.view')}
          <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  const shell = cn(
    'gap-tight p-gutter flex min-h-24 flex-col rounded-2xl ring-1',
    TONES[tone],
    className,
  );

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        'ease-standard transition-[box-shadow,transform] duration-200',
        'hover:shadow-card hover:-translate-y-0.5',
      )}
    >
      {body}
    </Link>
  );
}
