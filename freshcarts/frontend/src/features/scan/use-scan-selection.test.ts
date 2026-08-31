import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  makeAmbiguousItem,
  makeMatchedItem,
  makeNotFoundItem,
  makeScanCandidate,
  makeScanResult,
} from '@/test/fixtures';
import { useScanSelection } from './use-scan-selection';

/**
 * The shopper's decisions about a scanned list.
 *
 * Tested directly because this is where the rules that protect them live: what
 * arrives pre-selected, what a quantity may be, and — most importantly — what
 * is actually sent to the server.
 */

describe('useScanSelection', () => {
  it('pre-selects only the confidently matched lines', () => {
    // §27: an ambiguous line arrives blank so the shopper has to look at it.
    const { result } = renderHook(() => useScanSelection(makeScanResult()));

    expect(result.current.lines[0].chosen?.name).toContain('Olper');
    expect(result.current.lines[1].chosen).toBeNull();
    expect(result.current.lines[2].chosen).toBeNull();
  });

  it('counts undecided lines as needing attention', () => {
    const { result } = renderHook(() => useScanSelection(makeScanResult()));

    expect(result.current.readyLines).toHaveLength(1);
    expect(result.current.needsAttentionCount).toBe(2);
  });

  it('sends only product ids and quantities', () => {
    // §61: there is no field in this payload that could influence a price.
    const { result } = renderHook(() => useScanSelection(makeScanResult()));

    const payload = result.current.toConfirmInput();

    expect(payload).toEqual([{ productId: 'p-milk-olpers', quantity: 2 }]);
    expect(Object.keys(payload[0]).sort()).toEqual(['productId', 'quantity']);
  });

  describe('choosing an alternative', () => {
    it('makes the line ready and resets the quantity to what was written', () => {
      const { result } = renderHook(() => useScanSelection(makeScanResult()));
      const [surf] = makeAmbiguousItem().alternatives;

      act(() => result.current.choose('line-2', surf));

      expect(result.current.readyLines).toHaveLength(2);
      expect(result.current.needsAttentionCount).toBe(1);
    });

    it('caps the quantity to what the newly chosen product has', () => {
      // Switching from a well-stocked pack to a nearly sold out one must not
      // leave an impossible quantity behind.
      const item = makeMatchedItem({
        source: { ...makeMatchedItem().source, quantity: 8 },
      });
      const { result } = renderHook(() => useScanSelection(makeScanResult({ items: [item] })));

      act(() => result.current.choose('line-1', makeScanCandidate({ availableQuantity: 3 })));

      expect(result.current.lines[0].quantity).toBe(3);
      expect(result.current.lines[0].cappedByStock).toBe(true);
    });
  });

  describe('quantities', () => {
    it('never exceeds the available stock', () => {
      // §33: the cart could not accept it anyway, and offering the number is
      // how a shopper is misled about what they are getting.
      const item = makeMatchedItem({
        match: {
          status: 'MATCHED',
          confidence: 'HIGH',
          product: makeScanCandidate({ availableQuantity: 4 }),
        },
      });
      const { result } = renderHook(() => useScanSelection(makeScanResult({ items: [item] })));

      act(() => result.current.setQuantity('line-1', 99));

      expect(result.current.lines[0].quantity).toBe(4);
    });

    it('never falls below one', () => {
      const { result } = renderHook(() => useScanSelection(makeScanResult()));

      act(() => result.current.setQuantity('line-1', 0));

      expect(result.current.lines[0].quantity).toBe(1);
    });

    it('caps a written quantity that exceeds stock, and flags that it did', () => {
      const item = makeMatchedItem({
        source: { ...makeMatchedItem().source, rawText: '10 anday', quantity: 10 },
        match: {
          status: 'MATCHED',
          confidence: 'HIGH',
          product: makeScanCandidate({ availableQuantity: 4 }),
        },
      });

      const { result } = renderHook(() => useScanSelection(makeScanResult({ items: [item] })));

      expect(result.current.lines[0].quantity).toBe(4);
      expect(result.current.lines[0].cappedByStock).toBe(true);
    });
  });

  describe('removing', () => {
    it('takes a line out of the payload but keeps it undoable', () => {
      const { result } = renderHook(() => useScanSelection(makeScanResult()));

      act(() => result.current.remove('line-1'));
      expect(result.current.toConfirmInput()).toEqual([]);

      act(() => result.current.restore('line-1'));
      expect(result.current.toConfirmInput()).toHaveLength(1);
    });
  });

  describe('after a partial add', () => {
    it('excludes added lines from both the payload and the attention count', () => {
      // §31: coming back to finish the list must not re-add what is already in
      // the cart.
      const { result } = renderHook(() => useScanSelection(makeScanResult()));

      act(() => result.current.markAdded(['p-milk-olpers']));

      expect(result.current.toConfirmInput()).toEqual([]);
      expect(result.current.lines[0].addedToCart).toBe(true);
      expect(result.current.needsAttentionCount).toBe(2);
    });
  });

  describe('the estimated total', () => {
    it('counts only what can actually be bought', () => {
      const soldOut = makeMatchedItem({
        lineId: 'line-4',
        match: {
          status: 'MATCHED',
          confidence: 'HIGH',
          product: makeScanCandidate({ availableQuantity: 0, isAvailable: false, price: 500 }),
        },
      });

      const { result } = renderHook(() =>
        useScanSelection(
          makeScanResult({ items: [makeMatchedItem(), soldOut, makeNotFoundItem()] }),
        ),
      );

      // 340 x 2, and nothing for the sold-out line.
      expect(result.current.estimatedTotal).toBe(680);
    });
  });

  describe('re-scanning', () => {
    it('replaces the whole review rather than merging into it', () => {
      const { result, rerender } = renderHook(({ scan }) => useScanSelection(scan), {
        initialProps: { scan: makeScanResult() },
      });

      act(() => result.current.remove('line-1'));

      rerender({
        scan: makeScanResult({ scanId: 'scan-2', items: [makeMatchedItem({ lineId: 'x' })] }),
      });

      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0].removed).toBe(false);
    });
  });
});
