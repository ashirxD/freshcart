import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TimelineStep } from '@/types/order';

export interface OrderTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

/** "2 Feb, 3:40 pm" — enough to be useful, short enough for a phone. */
function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * THE ORDER'S JOURNEY (§37)
 *
 * Rendered entirely from what the API sent. `isComplete` and `isCurrent` are
 * the server's answers, computed from the recorded status history against the
 * state machine for *this* order's fulfilment method — which is why a pickup
 * order shows "Ready for pickup" and a delivery order shows "Out for delivery"
 * without this component knowing either rule.
 *
 * WHAT MAKES IT FRIENDLY RATHER THAN A STATUS LIST
 * Done steps get a filled leaf-green tick and a solid line down to the next
 * one. The step in progress gets a ringed marker with a slowly pulsing core, a
 * bold label and a tinted row, so "we are here" is obvious at a glance. Steps
 * still to come are hollow with a dashed line, which reads as "not yet" rather
 * than as "failed".
 *
 * Each state is signalled three ways: shape (filled tick / ring / hollow),
 * weight, and the visible label. Never colour alone.
 */
export function OrderTimeline({ steps, className }: OrderTimelineProps) {
  return (
    <ol className={cn('flex list-none flex-col', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isPending = !step.isComplete && !step.isCurrent;

        return (
          <li
            key={step.status}
            className={cn(
              'gap-gutter -mx-2 flex rounded-xl px-2 transition-colors',
              step.isCurrent && 'bg-primary/6',
            )}
          >
            {/* Marker column: the dot, and the line down to the next step. */}
            <div className="flex flex-col items-center pt-0.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  step.isComplete && 'bg-leaf text-on-primary',
                  step.isCurrent && 'bg-surface ring-primary ring-2',
                  isPending && 'bg-surface ring-outline-variant ring-2',
                )}
              >
                {step.isComplete ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                ) : step.isCurrent ? (
                  <span
                    aria-hidden="true"
                    className="bg-primary size-2.5 animate-pulse rounded-full"
                  />
                ) : null}
              </span>

              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-0.5 flex-1',
                    step.isComplete
                      ? 'bg-leaf'
                      : // Dashed for what has not happened yet: a solid grey
                        // line reads as a step that was skipped.
                        'bg-[repeating-linear-gradient(to_bottom,var(--color-outline-variant)_0_4px,transparent_4px_8px)]',
                  )}
                />
              ) : null}
            </div>

            <div className={cn('flex flex-col gap-0.5 pt-0.5', isLast ? 'pb-2' : 'pb-loose')}>
              <span className="flex flex-wrap items-baseline gap-2">
                <span
                  className={cn(
                    'text-sm',
                    step.isCurrent && 'text-text font-bold',
                    step.isComplete && 'text-text font-semibold',
                    isPending && 'text-text-muted font-medium',
                  )}
                >
                  {step.label}
                </span>

                {/*
                  The state in words as well as in shape, for screen readers and
                  for anyone who cannot tell the markers apart.
                */}
                <span className="sr-only">
                  {step.isComplete ? 'Completed' : step.isCurrent ? 'In progress' : 'Not yet'}
                </span>

                {step.changedAt ? (
                  <span className="text-text-muted text-xs tabular-nums">
                    {formatMoment(step.changedAt)}
                  </span>
                ) : null}
              </span>

              {step.note && (step.isComplete || step.isCurrent) ? (
                <span className="text-text-muted text-sm">{step.note}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
