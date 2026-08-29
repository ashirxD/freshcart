import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders a "See all" affordance when provided. */
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

/** The heading pattern used above every content section on the home screen. */
export function SectionHeader({
  title,
  subtitle,
  actionHref,
  actionLabel = 'See all',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-gutter', className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
      </div>

      {actionHref ? (
        <Link
          href={actionHref}
          className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary"
        >
          {actionLabel}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
