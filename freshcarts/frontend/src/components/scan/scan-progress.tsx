'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The stages a shopper is told about while their list is read (§44, §45).
 *
 * Friendly language, no implementation detail: "Reading your list", never
 * "Calling FastAPI" or "Running Tesseract". Somebody photographing a shopping
 * list does not need to know our architecture, and telling them makes a simple
 * thing feel complicated.
 */
const STAGES = [
  { id: 'reading', label: 'Reading your list…' },
  { id: 'finding', label: 'Finding your groceries…' },
  { id: 'matching', label: 'Matching products…' },
] as const;

/**
 * Roughly how long each stage takes, from measured OCR runs on phone photos.
 *
 * These advance the LABEL only. There is no percentage anywhere on this screen,
 * because the backend reports no progress and §44 is explicit that inventing
 * one is not acceptable. What the shopper sees is which stage we are on — which
 * is true — and a spinner, which is honest about not knowing how long is left.
 */
const STAGE_DURATIONS_MS = [2_000, 2_500];

export function ScanProgress() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;

    const timer = setTimeout(() => setStage((current) => current + 1), STAGE_DURATIONS_MS[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <div
      className="gap-lg py-lg flex flex-col items-center"
      // The whole block is announced when it appears, and again as stages
      // change, so a screen-reader user is not left in silence.
      role="status"
      aria-live="polite"
    >
      <div className="bg-primary/10 flex size-20 items-center justify-center rounded-full">
        <Loader2 className="text-primary size-9 animate-spin" aria-hidden="true" />
      </div>

      <ol className="gap-xs flex w-full max-w-xs flex-col">
        {STAGES.map((entry, index) => {
          const isDone = index < stage;
          const isCurrent = index === stage;

          return (
            <li
              key={entry.id}
              className={cn(
                'gap-xs flex items-center text-sm',
                isCurrent ? 'text-text font-medium' : isDone ? 'text-text-muted' : 'text-outline',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  isDone
                    ? 'border-primary bg-primary text-on-primary'
                    : isCurrent
                      ? 'border-primary'
                      : 'border-outline-variant',
                )}
                aria-hidden="true"
              >
                {isDone ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>

              {entry.label}
            </li>
          );
        })}
      </ol>

      <p className="text-text-muted px-page max-w-sm text-center text-sm">
        This usually takes a few seconds. Please keep this page open.
      </p>
    </div>
  );
}
