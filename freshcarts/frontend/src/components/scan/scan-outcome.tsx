'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import type { ScanConfirmation } from '@/types/scan';

export interface ScanOutcomeProps {
  outcome: ScanConfirmation;
  onScanAnother: () => void;
  /** Returns to the review screen so the unresolved items can be sorted out. */
  onReviewRemaining: () => void;
  /** Lines still needing a decision back on the review screen. */
  remainingCount: number;
}

/**
 * What happened when the list was added (§31, §62).
 *
 * Partial success is shown as partial success — both lists, plainly. The
 * alternative, an all-or-nothing failure, would mean a shopper photographing a
 * ten-item list and getting nothing because the eggs ran out; and a silent
 * partial success would mean discovering the gap at the till.
 */
export function ScanOutcome({
  outcome,
  onScanAnother,
  onReviewRemaining,
  remainingCount,
}: ScanOutcomeProps) {
  const addedCount = outcome.added.reduce((sum, entry) => sum + entry.quantity, 0);
  const hasFailures = outcome.failed.length > 0;

  return (
    <section
      aria-labelledby="scan-outcome-heading"
      role="status"
      className="gap-lg py-lg flex flex-col"
    >
      <header className="gap-xs flex flex-col items-center text-center">
        <span
          className={
            'flex size-16 items-center justify-center rounded-full ' +
            (outcome.added.length > 0
              ? 'bg-primary/10 text-primary'
              : 'bg-surface-sunken text-text-muted')
          }
        >
          {outcome.added.length > 0 ? (
            <CheckCircle2 className="size-8" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-8" aria-hidden="true" />
          )}
        </span>

        <h1 id="scan-outcome-heading" className="text-text text-xl font-bold">
          {outcome.added.length > 0 ? 'Added to your cart' : 'Nothing could be added'}
        </h1>

        {outcome.added.length > 0 ? (
          <p className="text-text-muted text-sm">
            {addedCount} {addedCount === 1 ? 'item' : 'items'} across {outcome.added.length}{' '}
            {outcome.added.length === 1 ? 'product' : 'products'}.
          </p>
        ) : null}
      </header>

      {outcome.added.length > 0 ? (
        <OutcomeList
          title="Added"
          tone="success"
          entries={outcome.added.map((entry) => ({
            key: entry.productId,
            name: entry.productName,
            detail: '×' + entry.quantity,
          }))}
        />
      ) : null}

      {hasFailures ? (
        <OutcomeList
          title="Could not be added"
          tone="warning"
          entries={outcome.failed.map((entry) => ({
            key: entry.productId,
            name: entry.productName ?? 'This item',
            // The server's own sentence: it names the product and the number.
            detail: entry.reason,
          }))}
        />
      ) : null}

      <div className="gap-xs flex flex-col">
        <ButtonLink href="/cart" size="lg" fullWidth>
          Go to cart
        </ButtonLink>

        {remainingCount > 0 ? (
          <Button variant="outline" fullWidth onClick={onReviewRemaining}>
            {/* §31: the unresolved items are still there to sort out. */}
            Sort out the remaining {remainingCount === 1 ? 'item' : remainingCount + ' items'}
          </Button>
        ) : null}

        <Button variant="ghost" fullWidth onClick={onScanAnother}>
          Scan another list
        </Button>
      </div>
    </section>
  );
}

function OutcomeList({
  title,
  tone,
  entries,
}: {
  title: string;
  tone: 'success' | 'warning';
  entries: Array<{ key: string; name: string; detail: string }>;
}) {
  return (
    <div className="gap-xs flex flex-col">
      <h2 className="text-text-muted text-xs font-semibold tracking-wide uppercase">{title}</h2>

      <ul className="border-outline-variant bg-surface divide-outline-variant divide-y rounded-lg border">
        {entries.map((entry) => (
          <li key={entry.key} className="gap-gutter p-gutter flex items-center justify-between">
            <span className="text-text min-w-0 truncate text-sm font-medium">{entry.name}</span>
            <span
              className={
                'shrink-0 text-sm ' + (tone === 'success' ? 'text-text-muted' : 'text-danger')
              }
            >
              {entry.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
