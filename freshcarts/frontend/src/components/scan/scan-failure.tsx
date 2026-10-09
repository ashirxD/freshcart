'use client';

import { CameraOff, RefreshCw, Search, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { useI18n, useT, type Locale, type TFunction } from '@/i18n';
import { ApiError } from '@/lib/api/errors';

export interface ScanFailureProps {
  error: unknown;
  onRetry: () => void;
}

interface FailureCopy {
  icon: ReactNode;
  title: string;
  message: string;
  /** Concrete things to try. Never "contact support" as the only option. */
  suggestions: string[];
  retryLabel: string;
}

/**
 * Every way a scan can fail, each with its own screen (§57, §58, §59).
 *
 * Branching on the server's stable `code` rather than on its prose: the message
 * is copy and may be reworded at any time, while the code is the contract. The
 * server's own sentence is shown where it names something specific; where it
 * does not, this adds advice the shopper can act on.
 *
 * What is never shown: a status code, a stack trace, a service name, a
 * timeout class (§36, §45).
 */
function copyFor(error: unknown, t: TFunction, locale: Locale): FailureCopy {
  const code = error instanceof ApiError ? error.code : undefined;

  if (error instanceof ApiError && error.isNetworkError) {
    return {
      icon: <WifiOff className="size-7" aria-hidden="true" />,
      title: t('ocr.failure.offlineTitle'),
      message: t('ocr.failure.offlineMessage'),
      suggestions: [t('ocr.failure.offlineS1'), t('ocr.failure.offlineS2')],
      retryLabel: t('ocr.failure.tryAgain'),
    };
  }

  switch (code) {
    case 'IMAGE_UNREADABLE':
      // §59: the photo is the problem, and saying so plainly is more useful
      // than pretending OCR succeeded and returning nothing.
      return {
        icon: <CameraOff className="size-7" aria-hidden="true" />,
        title: t('ocr.failure.unreadableTitle'),
        message: t('ocr.failure.unreadableMessage'),
        suggestions: [
          t('ocr.failure.unreadableS1'),
          t('ocr.failure.unreadableS2'),
          t('ocr.failure.unreadableS3'),
        ],
        retryLabel: t('ocr.failure.tryAnotherPhoto'),
      };

    case 'IMAGE_TOO_LARGE':
      return {
        icon: <CameraOff className="size-7" aria-hidden="true" />,
        title: t('ocr.failure.tooLargeTitle'),
        message:
          locale === 'en' && error instanceof ApiError
            ? error.message
            : t('ocr.failure.tooLargeMessage'),
        suggestions: [t('ocr.failure.tooLargeS1'), t('ocr.failure.tooLargeS2')],
        retryLabel: t('ocr.failure.chooseAnotherPhoto'),
      };

    case 'IMAGE_INVALID':
      return {
        icon: <CameraOff className="size-7" aria-hidden="true" />,
        title: t('ocr.failure.invalidTitle'),
        message: t('ocr.failure.invalidMessage'),
        suggestions: [t('ocr.failure.invalidS1'), t('ocr.failure.invalidS2')],
        retryLabel: t('ocr.failure.chooseAnotherPhoto'),
      };

    case 'SCAN_UNAVAILABLE':
    case 'SCAN_FAILED':
      // §36: the shopper is told the truth — it is us, not them — without any
      // hint of what actually broke.
      return {
        icon: <RefreshCw className="size-7" aria-hidden="true" />,
        title: t('ocr.failure.unavailableTitle'),
        message: t('ocr.failure.unavailableMessage'),
        suggestions: [t('ocr.failure.unavailableS1'), t('ocr.failure.searchSuggestion')],
        retryLabel: t('ocr.failure.tryAgain'),
      };

    default:
      return {
        icon: <RefreshCw className="size-7" aria-hidden="true" />,
        title: t('ocr.failure.genericTitle'),
        message:
          locale === 'en' && error instanceof ApiError
            ? error.message
            : t('ocr.failure.genericMessage'),
        suggestions: [t('ocr.failure.genericS1'), t('ocr.failure.searchSuggestion')],
        retryLabel: t('ocr.failure.tryAgain'),
      };
  }
}

export function ScanFailure({ error, onRetry }: ScanFailureProps) {
  const { t, locale } = useI18n();
  const copy = copyFor(error, t, locale);

  return (
    <section
      // Announced immediately: a failure a shopper cannot see is a shopper
      // waiting forever.
      role="alert"
      className="gap-loose py-loose flex flex-col items-center text-center"
    >
      <span className="bg-surface-sunken text-text-muted flex size-16 items-center justify-center rounded-full">
        {copy.icon}
      </span>

      <div className="gap-tight flex flex-col">
        <h2 className="text-text text-lg font-semibold">{copy.title}</h2>
        <p className="text-text-muted text-sm">{copy.message}</p>
      </div>

      <ul className="text-text-muted flex flex-col gap-1 text-sm">
        {copy.suggestions.map((suggestion) => (
          <li key={suggestion}>{suggestion}</li>
        ))}
      </ul>

      <div className="gap-tight flex w-full max-w-xs flex-col">
        <Button fullWidth onClick={onRetry}>
          {copy.retryLabel}
        </Button>

        {/* Never a dead end: there is always a way to keep shopping. */}
        <ButtonLink href="/search" variant="outline" fullWidth>
          <Search className="size-4" aria-hidden="true" />
          {t('ocr.failure.searchInstead')}
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * The "we read your photo, and there were no groceries on it" screen (§58).
 *
 * A different outcome from a failure and deliberately a different component:
 * the scan worked, so the advice is about what was in the frame rather than
 * about the photo's quality.
 */
export function ScanEmptyResult({ onRetry }: { onRetry: () => void }) {
  const t = useT();

  return (
    <section role="status" className="gap-loose py-loose flex flex-col items-center text-center">
      <span className="bg-surface-sunken text-text-muted flex size-16 items-center justify-center rounded-full">
        <Search className="size-7" aria-hidden="true" />
      </span>

      <div className="gap-tight flex flex-col">
        <h2 className="text-text text-lg font-semibold">
          {t('ocr.failure.emptyTitle')}
        </h2>
        <p className="text-text-muted text-sm">
          {t('ocr.failure.emptyMessage')}
        </p>
      </div>

      <ul className="text-text-muted flex flex-col gap-1 text-sm">
        <li>{t('ocr.failure.emptyS1')}</li>
        <li>{t('ocr.failure.emptyS2')}</li>
        <li>{t('ocr.failure.emptyS3')}</li>
      </ul>

      <div className="gap-tight flex w-full max-w-xs flex-col">
        <Button fullWidth onClick={onRetry}>
          {t('ocr.failure.tryAnotherPhoto')}
        </Button>

        <ButtonLink href="/categories" variant="outline" fullWidth>
          {t('ocr.failure.browseProducts')}
        </ButtonLink>
      </div>
    </section>
  );
}
