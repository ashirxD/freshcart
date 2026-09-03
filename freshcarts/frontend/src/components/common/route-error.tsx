'use client';

import { useEffect, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The shared body of every Next.js `error.tsx` in the app.
 *
 * WHAT AN ERROR BOUNDARY IS FOR HERE (section 79): one component throwing must
 * not take the whole application down. Each route group has its own boundary,
 * so a failure inside the back office leaves the storefront running, and a
 * failure on one admin screen leaves the sidebar and every other screen usable.
 *
 * WHAT IS NOT SHOWN: the error's own message. A thrown render error carries a
 * stack, a component name, sometimes a query string — none of which a person
 * can act on, and some of which should not be on screen. The digest is shown
 * instead: it is the id that ties this screen to the server log, so a support
 * conversation can start with something specific.
 *
 * Two ways out, never one: retry, and a way back to somewhere that works. A
 * screen with a single dead "try again" that keeps failing is a trap (§50).
 */
export function RouteError({
  error,
  reset,
  title,
  description,
  secondaryAction,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  description: string;
  secondaryAction?: ReactNode;
}) {
  useEffect(() => {
    // The full error goes to the console for a developer; the screen does not
    // show it. In production this is where a reporting call would go.
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="gap-gutter px-page py-loose mx-auto flex max-w-md flex-col items-center text-center"
    >
      <span className="bg-surface-muted text-danger flex size-16 items-center justify-center rounded-full">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>

      <div className="gap-tight flex flex-col">
        <h1 className="text-text text-lg font-semibold">{title}</h1>
        <p className="text-text-muted text-sm">{description}</p>
      </div>

      <div className="gap-gutter flex flex-wrap items-center justify-center">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        {secondaryAction}
      </div>

      {error.digest ? (
        <p className="text-text-muted text-xs">
          Reference: <span className="tabular-nums">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
