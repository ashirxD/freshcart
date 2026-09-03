'use client';

import { CameraOff, RefreshCw, Search, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
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
function copyFor(error: unknown): FailureCopy {
  const code = error instanceof ApiError ? error.code : undefined;

  if (error instanceof ApiError && error.isNetworkError) {
    return {
      icon: <WifiOff className="size-7" aria-hidden="true" />,
      title: 'You appear to be offline',
      message: 'We could not reach FreshCarts to read your list.',
      suggestions: ['Check your mobile data or Wi-Fi', 'Try again in a moment'],
      retryLabel: 'Try again',
    };
  }

  switch (code) {
    case 'IMAGE_UNREADABLE':
      // §59: the photo is the problem, and saying so plainly is more useful
      // than pretending OCR succeeded and returning nothing.
      return {
        icon: <CameraOff className="size-7" aria-hidden="true" />,
        title: 'The image is difficult to read',
        message: 'We could not make out the writing on that photo.',
        suggestions: [
          'Try taking a clearer photo in good light',
          'Hold the camera steady and fill the frame with the list',
          'Flatten the paper so the whole list is in focus',
        ],
        retryLabel: 'Try another photo',
      };

    case 'IMAGE_TOO_LARGE':
      return {
        icon: <CameraOff className="size-7" aria-hidden="true" />,
        title: 'That photo is too large',
        message:
          error instanceof ApiError ? error.message : 'Please use a smaller photo of your list.',
        suggestions: ['Take the photo again at a lower resolution', 'Crop it to just the list'],
        retryLabel: 'Choose another photo',
      };

    case 'IMAGE_INVALID':
      return {
        icon: <CameraOff className="size-7" aria-hidden="true" />,
        title: 'That file is not a photo',
        message: 'We can read JPG, PNG and WEBP images.',
        suggestions: ['Choose a photo from your gallery', 'Take a new photo of your list'],
        retryLabel: 'Choose another photo',
      };

    case 'SCAN_UNAVAILABLE':
    case 'SCAN_FAILED':
      // §36: the shopper is told the truth — it is us, not them — without any
      // hint of what actually broke.
      return {
        icon: <RefreshCw className="size-7" aria-hidden="true" />,
        title: 'We could not read your list right now',
        message: 'Scanning is temporarily unavailable. Everything else still works.',
        suggestions: ['Try again in a few minutes', 'Add your items by searching instead'],
        retryLabel: 'Try again',
      };

    default:
      return {
        icon: <RefreshCw className="size-7" aria-hidden="true" />,
        title: 'Something went wrong',
        message:
          error instanceof ApiError
            ? error.message
            : 'We could not process that photo. Please try again.',
        suggestions: ['Try again with another photo', 'Add your items by searching instead'],
        retryLabel: 'Try again',
      };
  }
}

export function ScanFailure({ error, onRetry }: ScanFailureProps) {
  const copy = copyFor(error);

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
          Search for items instead
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
  return (
    <section role="status" className="gap-loose py-loose flex flex-col items-center text-center">
      <span className="bg-surface-sunken text-text-muted flex size-16 items-center justify-center rounded-full">
        <Search className="size-7" aria-hidden="true" />
      </span>

      <div className="gap-tight flex flex-col">
        <h2 className="text-text text-lg font-semibold">
          We couldn&rsquo;t find any grocery items in this image
        </h2>
        <p className="text-text-muted text-sm">
          The photo was readable, but nothing on it looked like a shopping list.
        </p>
      </div>

      <ul className="text-text-muted flex flex-col gap-1 text-sm">
        <li>Make sure the list itself is in the photo</li>
        <li>Try a clearer photo with the writing facing up</li>
        <li>One item per line reads best</li>
      </ul>

      <div className="gap-tight flex w-full max-w-xs flex-col">
        <Button fullWidth onClick={onRetry}>
          Try another photo
        </Button>

        <ButtonLink href="/categories" variant="outline" fullWidth>
          Browse products
        </ButtonLink>
      </div>
    </section>
  );
}
