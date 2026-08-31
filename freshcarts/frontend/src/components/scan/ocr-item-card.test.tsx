import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  makeAmbiguousItem,
  makeMatchedItem,
  makeNotFoundItem,
  makeScanCandidate,
} from '@/test/fixtures';
import type { SelectionLine } from '@/features/scan/use-scan-selection';
import type { ScanItem } from '@/types/scan';
import { OcrItemCard } from './ocr-item-card';

/**
 * §26: one card, every state.
 *
 * These tests exist to keep it that way. Each one drives the same component
 * with a different line and asserts the shopper gets something they can act on
 * — which is the property that would quietly break if a second card component
 * ever appeared.
 */

function line(item: ScanItem, overrides: Partial<SelectionLine> = {}): SelectionLine {
  return {
    lineId: item.lineId,
    item,
    chosen: item.match.product,
    quantity: item.source.quantity,
    removed: false,
    addedToCart: false,
    cappedByStock: false,
    ...overrides,
  };
}

function renderCard(subject: SelectionLine) {
  const props = {
    onChangeProduct: vi.fn(),
    onQuantityChange: vi.fn(),
    onRemove: vi.fn(),
    onRestore: vi.fn(),
  };

  // Wrapped in a list, because the card renders an <li> and an orphan <li>
  // produces a DOM the accessibility queries cannot read the way a browser does.
  render(
    <ul>
      <OcrItemCard line={subject} {...props} />
    </ul>,
  );

  return props;
}

describe('OcrItemCard', () => {
  it('always shows what the shopper actually wrote', () => {
    // §10: the raw text is what makes a wrong match explainable.
    renderCard(line(makeMatchedItem()));

    expect(screen.getByText('You wrote')).toBeInTheDocument();
    expect(screen.getByText('2 doodh')).toBeInTheDocument();
  });

  it('renders Urdu text as Urdu, right to left', () => {
    // §50: the design system supplies the Nastaliq face via :lang(ur), which
    // only applies if the element is actually marked up as Urdu.
    const item = makeMatchedItem();
    renderCard(line({ ...item, source: { ...item.source, rawText: '۲ دودھ', script: 'urdu' } }));

    const written = screen.getByText('۲ دودھ');
    expect(written).toHaveAttribute('lang', 'ur');
    expect(written).toHaveAttribute('dir', 'rtl');
  });

  it('states its status in words, not only in colour', () => {
    // §49: a coloured border says nothing to a screen reader, and nothing to a
    // shopper who cannot distinguish it.
    renderCard(line(makeMatchedItem()));
    expect(screen.getByText('Found')).toBeInTheDocument();
  });

  describe('a matched line', () => {
    it('shows the product, its pack size and the line total', () => {
      renderCard(line(makeMatchedItem()));

      expect(screen.getByText('Olper’s Full Cream Milk')).toBeInTheDocument();
      expect(screen.getByText(/1 L/)).toBeInTheDocument();
      expect(screen.getByText(/Rs\. 680/)).toBeInTheDocument();
    });

    it('offers a way to change the product and to remove the line', async () => {
      const user = userEvent.setup();
      const handlers = renderCard(line(makeMatchedItem()));

      await user.click(screen.getByRole('button', { name: 'Change product' }));
      expect(handlers.onChangeProduct).toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Remove' }));
      expect(handlers.onRemove).toHaveBeenCalled();
    });
  });

  describe('an ambiguous line', () => {
    it('says so plainly and asks for a choice', () => {
      // §27: never presented as decided.
      renderCard(line(makeAmbiguousItem()));

      expect(screen.getByText('Needs a choice')).toBeInTheDocument();
      expect(screen.getByText(/we’re not sure which product you mean/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose a product' })).toBeInTheDocument();
    });

    it('shows no quantity control until a product is chosen', () => {
      renderCard(line(makeAmbiguousItem()));

      expect(screen.queryByRole('button', { name: /increase quantity/i })).not.toBeInTheDocument();
    });
  });

  describe('a line nothing matched', () => {
    it('offers a search rather than a dead end', () => {
      // §28.
      renderCard(line(makeNotFoundItem()));

      expect(screen.getByText(/we couldn’t find this item/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /search for it yourself/i })).toHaveAttribute(
        'href',
        '/search?q=zafraan',
      );
    });
  });

  describe('stock', () => {
    it('explains a quantity that had to be reduced', () => {
      // §33: the number, so the shopper can change it.
      const item = makeMatchedItem();
      renderCard(
        line(
          {
            ...item,
            match: {
              ...item.match,
              product: makeScanCandidate({ availableQuantity: 4 }),
            },
          },
          { chosen: makeScanCandidate({ availableQuantity: 4 }), quantity: 4, cappedByStock: true },
        ),
      );

      expect(screen.getByText(/only 4 are available/i)).toBeInTheDocument();
    });

    it('marks a sold-out product and withdraws the quantity control', () => {
      const soldOut = makeScanCandidate({ availableQuantity: 0, isAvailable: false });
      const item = makeMatchedItem();

      renderCard(
        line({ ...item, match: { ...item.match, product: soldOut } }, { chosen: soldOut }),
      );

      expect(screen.getByText('Out of stock')).toBeInTheDocument();
      expect(screen.getByText(/will not be added/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /increase quantity/i })).not.toBeInTheDocument();
    });
  });

  describe('units (§22)', () => {
    it('says when the pack size differs from what was written', () => {
      const item = makeMatchedItem();
      const candidate = makeScanCandidate({ unitLabel: '1 kg', unitMatches: false });

      renderCard(
        line(
          {
            ...item,
            source: { ...item.source, rawText: '2 kg atta', unit: 'kg', unitValue: 2 },
            match: { ...item.match, product: candidate },
          },
          { chosen: candidate },
        ),
      );

      expect(screen.getByText(/you wrote 2 kg\. this comes as 1 kg/i)).toBeInTheDocument();
    });
  });

  describe('removed and added lines', () => {
    it('lets a removed line be put back', async () => {
      const user = userEvent.setup();
      const handlers = renderCard(line(makeMatchedItem(), { removed: true }));

      await user.click(screen.getByRole('button', { name: /undo/i }));
      expect(handlers.onRestore).toHaveBeenCalled();
    });

    it('shows an added line as added, not as removed', () => {
      // The distinction matters on the way back from a partial add: labelling a
      // successful addition "Removed" says the opposite of what happened.
      renderCard(line(makeMatchedItem(), { addedToCart: true }));

      expect(screen.getByText(/^Added/).closest('li')).toHaveTextContent('Full Cream Milk');
      expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    });
  });
});
