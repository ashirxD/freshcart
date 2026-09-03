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
 *
 * Three states, told three ways (§46): a tick on a filled disc for done, a
 * ringed disc and bold label for the current step, a hollow outline for what is
 * still to come. Never colour alone.
 */
export function CheckoutSteps({ steps, current, className }: CheckoutStepsProps) {
  return (
    <nav aria-label="Checkout progress" className={className}>
      <ol className="flex list-none items-start gap-1">
        {steps.map((label, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;

          return (
            <li key={label} className="flex flex-1 items-center gap-1">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    'ease-standard transition-[background-color,box-shadow,color] duration-200',
                    isComplete && 'bg-leaf text-on-primary',
                    isCurrent && 'bg-primary text-on-primary ring-primary/18 ring-4',
                    !isComplete &&
                      !isCurrent &&
                      'bg-surface text-text-muted ring-outline-variant ring-2',
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
                    isCurrent ? 'text-text font-bold' : 'text-text-muted font-medium',
                  )}
                >
                  {label}
                </span>
              </span>

              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-4 h-0.5 w-full flex-1 rounded-full transition-colors duration-300',
                    isComplete ? 'bg-leaf' : 'bg-outline-variant',
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
