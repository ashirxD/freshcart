'use client';

import { RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { describeError } from '@/lib/api/error-copy';
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
 * confuse — that becomes plain language plus a retry, and specifically language
 * that reassures rather than alarms (§49): nothing a shopper has done is lost
 * when a request fails, and the copy says so instead of implying a catastrophe.
 */
export function ErrorState({ error, onRetry, title, className }: ErrorStateProps) {
  const { t, locale } = useI18n();
  const isClientError = error instanceof ApiError && error.status < 500;

  const description = isClientError ? describeError(error, t, locale) : t('states.safeAndRetry');

  return (
    <div
      role="alert"
      className={cn(
        'gap-gutter bg-surface-muted px-page py-wide ring-outline-variant flex flex-col items-center',
        'rounded-2xl text-center ring-1',
        className,
      )}
    >
      <span className="bg-surface text-attention ring-sand flex size-14 items-center justify-center rounded-2xl ring-1">
        <Unplug className="size-6" aria-hidden="true" />
      </span>

      <div className="gap-tight flex flex-col">
        <h3 className="text-text text-base font-bold tracking-[-0.015em]">
          {title ?? t('states.somethingWentWrong')}
        </h3>
        <p className="text-text-muted max-w-sm text-sm leading-relaxed">{description}</p>
      </div>

      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-4" aria-hidden="true" />}
        >
          {t('common.tryAgain')}
        </Button>
      ) : null}
    </div>
  );
}
