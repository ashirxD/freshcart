'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';

export interface ErrorStateProps {
  error: unknown;
  /** Wired to the query's `refetch`. Omitted when there is nothing to retry. */
  onRetry?: () => void;
  title?: string;
  className?: string;
}

/**
 * The failure state for every screen.
 *
 * A 4xx carries a message written for the shopper, so it is shown as-is.
 * Anything else is a server or network fault whose real message would only
 * confuse — that becomes plain language plus a retry.
 */
export function ErrorState({ error, onRetry, title, className }: ErrorStateProps) {
  const isClientError = error instanceof ApiError && error.status < 500;

  const description = isClientError
    ? (error as ApiError).message
    : 'Something went wrong at our end. Please check your connection and try again.';

  return (
    <div
      role="alert"
      className={cn(
        'gap-gutter bg-surface-muted px-page py-lg flex flex-col items-center rounded-lg text-center',
        className,
      )}
    >
      <span className="bg-surface text-danger flex size-14 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>

      <div className="gap-xs flex flex-col">
        <h3 className="text-text text-base font-semibold">{title ?? 'We could not load this'}</h3>
        <p className="text-text-muted max-w-sm text-sm">{description}</p>
      </div>

      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-4" aria-hidden="true" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
