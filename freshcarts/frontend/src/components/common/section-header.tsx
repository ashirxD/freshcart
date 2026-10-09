import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

/** The accent used by the eyebrow. Named for the kind of section, not the hue. */
export type SectionAccent = 'leaf' | 'offer' | 'berry' | 'teal';

const ACCENTS: Record<SectionAccent, string> = {
  leaf: 'text-leaf',
  offer: 'text-attention',
  berry: 'text-berry',
  teal: 'text-info',
};

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * A short tracked label above the title — "TODAY", "FRESH PICKS".
   *
   * This is what gives a section a voice without adding another heading level:
   * three type sizes in one block (eyebrow, title, subtitle) read as
   * deliberate, where a lone bold line reads as a template.
   */
  eyebrow?: string;
  accent?: SectionAccent;
  /** Renders a "See all" affordance when provided. */
  actionHref?: string;
  actionLabel?: string;
  /** Renders the title as an h3 — for a section nested inside another. */
  as?: 'h2' | 'h3';
  className?: string;
}

/** The heading pattern used above every content section on the storefront. */
export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  accent = 'leaf',
  actionHref,
  actionLabel,
  as: Heading = 'h2',
  className,
}: SectionHeaderProps) {
  const t = useT();

  return (
    <div className={cn('gap-gutter flex items-end justify-between', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <span className={cn('text-eyebrow uppercase', ACCENTS[accent])}>{eyebrow}</span>
        ) : null}

        <Heading className="text-section text-text">{title}</Heading>

        {subtitle ? <p className="text-text-muted text-sm">{subtitle}</p> : null}
      </div>

      {actionHref ? (
        <Link
          href={actionHref}
          className={cn(
            'group text-primary flex shrink-0 items-center gap-1.5 text-sm font-semibold',
            'hover:bg-primary/8 -me-3 min-h-11 rounded-full px-3 transition-colors',
          )}
        >
          {actionLabel ?? t('common.seeAll')}
          {/* The arrow travels on hover — the one bit of motion a "see all"
              needs to feel like a door rather than a label. */}
          <ArrowRight
            className="ease-standard size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
