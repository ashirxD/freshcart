import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
const TONES = {
  DEFAULT: 'border-outline-variant bg-surface text-text',
  ATTENTION: 'border-primary/40 bg-primary/5 text-primary',
  WARNING: 'border-secondary/40 bg-secondary-container/20 text-secondary',
  DANGER: 'border-danger/40 bg-danger/5 text-danger',
} as const;

/**
 * One number on the operations dashboard.
 *
 * Every tile is a link to the list that number came from: a count nobody can act
 * on is decoration, and §59 asks for exactly this — "7 products are low in
 * stock" with a way through to them.
 */
export function StatTile({ label, value, href, tone = 'DEFAULT', className }: StatTileProps) {
  const body = (
    <>
      <span className="text-2xl leading-none font-bold tabular-nums">{value}</span>
      <span className="text-sm leading-snug font-medium">{label}</span>
      {href ? (
        <span className="text-text-muted mt-auto flex items-center gap-0.5 text-xs">
          View
          <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  const shell = cn(
    'gap-xs flex min-h-24 flex-col rounded-lg border p-gutter',
    TONES[tone],
    tone !== 'DEFAULT' && 'font-semibold',
    className,
  );

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link href={href} className={cn(shell, 'hover:shadow-card transition-shadow')}>
      {body}
    </Link>
  );
}
