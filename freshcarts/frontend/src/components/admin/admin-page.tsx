'use client';

import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

/**
 * The shell every back-office screen shares.
 *
 * Extracted because eight screens need identical handling of the same four
 * states — loading, failed, empty, loaded — and sections 48, 49 and 50 require
 * all four to be useful on every one of them. Writing that per screen is how a
 * blank white page eventually ships on the least-visited one.
 */

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="gap-gutter mb-loose flex flex-wrap items-end justify-between">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-text text-xl font-bold tracking-[-0.02em]">{title}</h1>
        {description ? <p className="text-text-muted text-sm">{description}</p> : null}
      </div>

      {actions ? <div className="gap-tight flex items-center">{actions}</div> : null}
    </header>
  );
}

export interface AdminListStateProps {
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** True when the request succeeded and returned nothing. */
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** How many placeholder rows to draw while loading. */
  skeletonRows?: number;
  skeletonClassName?: string;
  children: ReactNode;
}

/**
 * Renders exactly one of: skeletons, an error with a retry, an empty state with
 * a next step, or the content.
 *
 * The empty state is never a bare "no results" — section 49 asks for something
 * useful, so every caller supplies a description, and most supply an action.
 */
export function AdminListState({
  isPending,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeletonRows = 6,
  skeletonClassName = 'h-16 w-full',
  children,
}: AdminListStateProps) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton
            key={index}
            className={skeletonClassName}
            // Only the first placeholder is announced: one polite "loading"
            // is information, six at once is noise in a screen reader.
            label={index === 0 ? 'Loading' : undefined}
          />
        ))}
      </div>
    );
  }

  if (isError) return <ErrorState error={error} onRetry={onRetry} />;

  if (isEmpty) {
    return (
      <EmptyState
        icon={<Inbox aria-hidden="true" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className="bg-surface-muted rounded-2xl"
      />
    );
  }

  return <>{children}</>;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Names what is being paged, so the control is unambiguous to a screen reader. */
  label: string;
}

/** Previous/next rather than numbered pages: an admin list is scanned, not indexed. */
export function Pagination({ page, totalPages, onPageChange, label }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={label} className="gap-gutter mt-loose flex items-center justify-center">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>

      <span aria-live="polite" className="text-text-muted text-sm">
        Page {page} of {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

/**
 * A horizontally scrollable wrapper for a wide table.
 *
 * The scroll lives here rather than on the page, so a table with eight columns
 * never makes the whole document scroll sideways on a phone.
 */
export function TableScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'ring-outline-variant bg-surface shadow-card overflow-x-auto rounded-2xl ring-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A filter chip row. `aria-pressed` carries the state, not colour alone. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-full border px-4 text-sm',
              'ease-standard transition-[background-color,border-color,color] duration-150',
              active
                ? 'border-primary bg-primary text-on-primary font-bold'
                : 'border-outline-variant bg-surface text-text-muted hover:border-primary/35 hover:bg-cream font-medium',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
