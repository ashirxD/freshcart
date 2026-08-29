import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Shown instead of a blank screen. Always pairs the explanation with a next
 * step, so a shopper is never left wondering what to do.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-gutter px-page py-lg text-center', className)}>
      {icon ? (
        <div className="flex size-16 items-center justify-center rounded-full bg-surface-muted text-primary">
          {icon}
        </div>
      ) : null}

      <div className="flex flex-col gap-xs">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {description ? (
          <p className="max-w-xs text-sm text-text-muted">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}
