'use client';

import { Check } from 'lucide-react';
import { useT } from '@/i18n';
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
  const t = useT();

  return (
    <nav aria-label={t('checkout.screen.progressLabel')} className={className}>
      <ol className="flex list-none items-start">
        {steps.map((label, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;

          return (
            // Each step owns an equal column, so a label can use the whole of it.
            // The connector is drawn absolutely, between this disc and the next,
            // instead of taking a share of the row: when it did, a four-step
            // checkout on a 390px phone left each label about 38px and truncated
            // "Method" to "Met…".
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  style={{
                    insetInlineStart: 'calc(50% + 1.5rem)',
                    insetInlineEnd: 'calc(-50% + 1.5rem)',
                  }}
                  className={cn(
                    'absolute top-[calc(1rem-1px)] h-0.5 rounded-full transition-colors duration-300',
                    isComplete ? 'bg-leaf' : 'bg-outline-variant',
                  )}
                />
              ) : null}

              <span
                className={cn(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
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
                    <span className="sr-only">{t('checkout.screen.stepDone')}</span>
                  </>
                ) : (
                  index + 1
                )}
              </span>

              <span
                className={cn(
                  'w-full px-0.5 text-center text-xs leading-tight',
                  isCurrent ? 'text-text font-bold' : 'text-text-muted font-medium',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
