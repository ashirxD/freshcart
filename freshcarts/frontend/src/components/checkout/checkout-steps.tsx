'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckoutStepsProps {
  steps: string[];
  /** Zero-based index of the step being worked on. */
  current: number;
  className?: string;
}

/**
 * Progress through checkout.
 *
 * A real ordered list, so a screen reader announces "step 2 of 4" and the
 * relationship between the steps survives without the visual line. The
 * decorative connector is a separate, aria-hidden element rather than a border
 * on the list item, so it never becomes part of the announced content.
 */
export function CheckoutSteps({ steps, current, className }: CheckoutStepsProps) {
  return (
    <nav aria-label="Checkout progress" className={className}>
      <ol className="flex list-none items-center gap-1">
        {steps.map((label, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;

          return (
            <li key={label} className="flex flex-1 items-center gap-1">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    isComplete && 'bg-primary text-on-primary',
                    isCurrent && 'bg-primary text-on-primary ring-4 ring-primary/15',
                    !isComplete && !isCurrent && 'bg-surface-sunken text-text-muted',
                  )}
                >
                  {isComplete ? (
                    <>
                      <Check className="size-4" aria-hidden="true" strokeWidth={3} />
                      <span className="sr-only">Completed</span>
                    </>
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={cn(
                    'w-full truncate text-center text-xs',
                    isCurrent ? 'font-semibold text-text' : 'text-text-muted',
                  )}
                >
                  {label}
                </span>
              </span>

              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    '-mt-5 h-0.5 w-full flex-1 rounded-full',
                    isComplete ? 'bg-primary' : 'bg-surface-sunken',
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
