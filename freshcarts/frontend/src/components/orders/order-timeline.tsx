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
 * The order's journey.
 *
 * Rendered entirely from what the API sent. `isComplete` and `isCurrent` are
 * the server's answers, computed from the recorded status history against the
 * state machine for *this* order's fulfilment method — which is why a pickup
 * order shows "Ready for pickup" and a delivery order shows "Out for delivery"
 * without this component knowing either rule (§37, §38).
 *
 * Each state is signalled three ways: shape (filled tick / ring / hollow),
 * weight, and the visible label. Never colour alone.
 */
export function OrderTimeline({ steps, className }: OrderTimelineProps) {
  return (
    <ol className={cn('flex list-none flex-col', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <li key={step.status} className="flex gap-gutter">
            {/* Marker column: the dot, and the line down to the next step. */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                  step.isComplete && 'border-primary bg-primary text-on-primary',
                  step.isCurrent && 'border-primary bg-surface ring-4 ring-primary/15',
                  !step.isComplete && !step.isCurrent && 'border-outline-variant bg-surface',
                )}
              >
                {step.isComplete ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                ) : step.isCurrent ? (
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                ) : null}
              </span>

              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-0.5 flex-1 rounded-full',
                    step.isComplete ? 'bg-primary' : 'bg-outline-variant',
                  )}
                />
              ) : null}
            </div>

            <div className={cn('flex flex-col gap-0.5', isLast ? 'pb-0' : 'pb-lg')}>
              <span className="flex flex-wrap items-baseline gap-2">
                <span
                  className={cn(
                    'text-sm',
                    step.isCurrent ? 'font-semibold text-text' : 'font-medium',
                    step.isComplete && 'text-text',
                    !step.isComplete && !step.isCurrent && 'text-text-muted',
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
                  <span className="text-xs text-text-muted">{formatMoment(step.changedAt)}</span>
                ) : null}
              </span>

              {step.note && (step.isComplete || step.isCurrent) ? (
                <span className="text-sm text-text-muted">{step.note}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
