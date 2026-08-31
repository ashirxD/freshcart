'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ScanCandidate, ScanItem, ScanResult } from '@/types/scan';

/**
 * The shopper's decisions about a scanned list.
 *
 * Local state, deliberately. Nothing outside the scan screen needs to know
 * which alternative was picked for line four, and putting a whole review
 * session into a global store would make it survive navigation in a way nobody
 * asked for — the same reasoning that kept checkout out of Zustand.
 *
 * What is derived rather than stored: prices, availability, product details.
 * Those come from the scan result, and the server re-reads all of them when the
 * list is confirmed (§34).
 */

export interface SelectionLine {
  lineId: string;
  item: ScanItem;
  /** The product the shopper has settled on, or null while undecided. */
  chosen: ScanCandidate | null;
  quantity: number;
  removed: boolean;
  /**
   * True once this line has actually reached the cart.
   *
   * Deliberately not the same flag as `removed`: a shopper returning to finish
   * the rest of their list needs to see that the milk is done, and labelling a
   * successful addition "Removed" would say the opposite of what happened.
   */
  addedToCart: boolean;
  /** True when the written quantity was more than the shop actually has (§33). */
  cappedByStock: boolean;
}

/** How many of `candidate` a shopper may take, given what is on the shelf. */
function ceilingFor(candidate: ScanCandidate | null): number {
  return candidate ? Math.max(candidate.availableQuantity, 0) : 99;
}

function initialLine(item: ScanItem): SelectionLine {
  // §27: only a decided line arrives pre-selected. An ambiguous one is left
  // blank so the shopper has to look at it.
  const chosen = item.match.status === 'MATCHED' ? item.match.product : null;
  const ceiling = ceilingFor(chosen);
  const requested = item.source.quantity;

  return {
    lineId: item.lineId,
    item,
    chosen,
    // Capped rather than clamped silently: `cappedByStock` is what the card
    // uses to say "we only have 4", so the change is visible (§33).
    quantity: chosen ? Math.max(1, Math.min(requested, ceiling || 1)) : requested,
    removed: false,
    addedToCart: false,
    cappedByStock: chosen !== null && ceiling > 0 && requested > ceiling,
  };
}

export interface ScanSelection {
  lines: SelectionLine[];
  /** Lines that will actually be sent when the shopper confirms. */
  readyLines: SelectionLine[];
  /** Lines still needing a decision — ambiguous, unmatched or sold out. */
  needsAttentionCount: number;
  /** Whole rupees. Only lines that can be bought contribute. */
  estimatedTotal: number;
  choose: (lineId: string, candidate: ScanCandidate) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  restore: (lineId: string) => void;
  /** Records that these product ids are now in the cart. */
  markAdded: (productIds: string[]) => void;
  /** The confirm payload: product ids and quantities, and nothing else (§61). */
  toConfirmInput: () => Array<{ productId: string; quantity: number }>;
}

export function useScanSelection(result: ScanResult | null): ScanSelection {
  const [lines, setLines] = useState<SelectionLine[]>(() => (result?.items ?? []).map(initialLine));
  const [scanId, setScanId] = useState<string | null>(result?.scanId ?? null);

  // Re-scanning replaces the whole review. Adjusting state during render is
  // React's own pattern for "props changed, derived state must follow"; an
  // effect would render one frame of the previous scan's lines against the new
  // result, which is exactly the flicker a shopper would notice.
  if (result && result.scanId !== scanId) {
    setScanId(result.scanId);
    setLines(result.items.map(initialLine));
  }

  const update = useCallback((lineId: string, change: (line: SelectionLine) => SelectionLine) => {
    setLines((current) => current.map((line) => (line.lineId === lineId ? change(line) : line)));
  }, []);

  const choose = useCallback(
    (lineId: string, candidate: ScanCandidate) => {
      update(lineId, (line) => {
        const ceiling = ceilingFor(candidate);
        const requested = line.item.source.quantity;

        return {
          ...line,
          chosen: candidate,
          // Reset to what was on the list, capped to what this particular
          // product has: switching from a well-stocked pack to a nearly sold
          // out one must not leave an impossible quantity behind.
          quantity: Math.max(1, Math.min(requested, ceiling || 1)),
          cappedByStock: ceiling > 0 && requested > ceiling,
          removed: false,
        };
      });
    },
    [update],
  );

  const setQuantity = useCallback(
    (lineId: string, quantity: number) => {
      update(lineId, (line) => ({
        ...line,
        quantity: Math.max(1, Math.min(quantity, ceilingFor(line.chosen) || 1)),
        // The shopper has now chosen the number themselves, so the "we reduced
        // this for you" note has served its purpose.
        cappedByStock: false,
      }));
    },
    [update],
  );

  const remove = useCallback(
    (lineId: string) => {
      // Removed rather than deleted, so "undo" is possible and a shopper who
      // taps the wrong bin does not lose a line they cannot get back (§28).
      update(lineId, (line) => ({ ...line, removed: true }));
    },
    [update],
  );

  const restore = useCallback(
    (lineId: string) => {
      update(lineId, (line) => ({ ...line, removed: false }));
    },
    [update],
  );

  const markAdded = useCallback((productIds: string[]) => {
    const added = new Set(productIds);

    setLines((current) =>
      current.map((line) =>
        line.chosen && added.has(line.chosen.productId) ? { ...line, addedToCart: true } : line,
      ),
    );
  }, []);

  const readyLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          !line.removed && !line.addedToCart && line.chosen !== null && line.chosen.isAvailable,
      ),
    [lines],
  );

  const needsAttentionCount = useMemo(
    () =>
      lines.filter(
        (line) =>
          !line.removed && !line.addedToCart && (line.chosen === null || !line.chosen.isAvailable),
      ).length,
    [lines],
  );

  const estimatedTotal = useMemo(
    // Integer rupees, so this addition is exact.
    () => readyLines.reduce((sum, line) => sum + (line.chosen?.price ?? 0) * line.quantity, 0),
    [readyLines],
  );

  const toConfirmInput = useCallback(
    () =>
      readyLines.flatMap((line) =>
        line.chosen ? [{ productId: line.chosen.productId, quantity: line.quantity }] : [],
      ),
    [readyLines],
  );

  return {
    lines,
    readyLines,
    needsAttentionCount,
    estimatedTotal,
    choose,
    setQuantity,
    remove,
    restore,
    markAdded,
    toConfirmInput,
  };
}
