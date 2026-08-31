'use client';

import { useState } from 'react';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { formatPkr } from '@/lib/format';
import type { ScanSelection } from '@/features/scan/use-scan-selection';
import type { ScanResult } from '@/types/scan';
import { AlternativesSheet } from './alternatives-sheet';
import { OcrItemCard } from './ocr-item-card';

export interface ScanReviewProps {
  result: ScanResult;
  selection: ScanSelection;
  isAdding: boolean;
  onAddAll: () => void;
  onRescan: () => void;
}

/**
 * "We found your groceries" — the review screen (§25).
 *
 * The whole feature turns on this screen being honest. It shows what was read,
 * what we matched it to, what we are unsure about and what we could not find,
 * and it adds nothing to a cart until the shopper presses the button (§60).
 */
export function ScanReview({ result, selection, isAdding, onAddAll, onRescan }: ScanReviewProps) {
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const editing = selection.lines.find((line) => line.lineId === editingLineId) ?? null;

  const readyCount = selection.readyLines.length;

  return (
    <section aria-labelledby="scan-review-heading" className="gap-lg flex flex-col">
      <header className="gap-xs flex flex-col">
        <h1 id="scan-review-heading" className="text-text text-xl font-bold">
          We found your groceries
        </h1>

        <ScanSummaryLine
          detected={selection.lines.filter((line) => !line.removed).length}
          ready={readyCount}
          needsAttention={selection.needsAttentionCount}
        />
      </header>

      {result.warnings.length > 0 ? (
        <ul className="border-secondary-container/60 bg-secondary-container/15 p-gutter flex flex-col gap-1 rounded-lg border text-sm">
          {result.warnings.map((warning) => (
            <li key={warning} className="text-text gap-xs flex items-start">
              <AlertTriangle className="text-secondary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="gap-xs flex flex-col">
        {selection.lines.map((line) => (
          <OcrItemCard
            key={line.lineId}
            line={line}
            onChangeProduct={() => setEditingLineId(line.lineId)}
            onQuantityChange={(quantity) => selection.setQuantity(line.lineId, quantity)}
            onRemove={() => selection.remove(line.lineId)}
            onRestore={() => selection.restore(line.lineId)}
          />
        ))}
      </ul>

      {/*
        The action bar is sticky on mobile, where the list runs well past a
        phone screen and a button at the very bottom would be a scroll away at
        all times.
      */}
      <div className="bg-background border-outline-variant py-gutter -mx-page px-page sticky bottom-16 z-10 border-t lg:static lg:mx-0 lg:border-0 lg:px-0">
        <div className="gap-xs flex flex-col">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-text-muted">Estimated total</span>
            <span className="text-text text-lg font-bold">
              {formatPkr(selection.estimatedTotal)}
            </span>
          </div>

          <p className="text-text-muted text-xs">
            {/* Never a promise: the cart re-prices everything when it is added. */}
            Final prices are confirmed when the items reach your cart.
          </p>

          <Button
            size="lg"
            fullWidth
            onClick={onAddAll}
            isLoading={isAdding}
            disabled={readyCount === 0}
            leadingIcon={<ShoppingCart className="size-5" />}
          >
            {readyCount === 0
              ? 'Nothing ready to add'
              : 'Add ' + readyCount + (readyCount === 1 ? ' item' : ' items') + ' to cart'}
          </Button>

          {readyCount === 0 ? (
            <p className="text-text-muted text-center text-xs">
              Choose a product for the items above, or scan a different list.
            </p>
          ) : null}

          <div className="gap-xs flex">
            <Button variant="ghost" fullWidth onClick={onRescan}>
              Scan another list
            </Button>
            <ButtonLink href="/cart" variant="ghost" fullWidth>
              Go to cart
            </ButtonLink>
          </div>
        </div>
      </div>

      <AlternativesSheet
        open={editing !== null}
        onClose={() => setEditingLineId(null)}
        rawText={editing?.item.source.rawText ?? ''}
        candidates={
          editing
            ? // The chosen product belongs in the list too, so the shopper can
              // see what is currently selected and change their mind back.
              [
                ...(editing.chosen ? [editing.chosen] : []),
                ...editing.item.alternatives.filter(
                  (candidate) => candidate.productId !== editing.chosen?.productId,
                ),
              ]
            : []
        }
        selectedProductId={editing?.chosen?.productId ?? null}
        onSelect={(candidate) => {
          if (editing) selection.choose(editing.lineId, candidate);
          setEditingLineId(null);
        }}
      />
    </section>
  );
}

/**
 * The one-line summary §31 asks for.
 *
 * Phrased as counts rather than as a warning, because a list where two items
 * need a choice is a normal, successful scan — not a failure.
 */
function ScanSummaryLine({
  detected,
  ready,
  needsAttention,
}: {
  detected: number;
  ready: number;
  needsAttention: number;
}) {
  return (
    <p className="text-text-muted text-sm">
      We read <strong className="text-text">{detected}</strong> {detected === 1 ? 'item' : 'items'}.{' '}
      <strong className="text-text">{ready}</strong> {ready === 1 ? 'is' : 'are'} ready to add
      {needsAttention > 0 ? (
        <>
          , and <strong className="text-text">{needsAttention}</strong>{' '}
          {needsAttention === 1 ? 'needs' : 'need'} your help
        </>
      ) : null}
      .
    </p>
  );
}
