'use client';

import { Modal } from '@/components/ui/modal';
import { ProductImage } from '@/components/product/product-image';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { Button } from '@/components/ui/button';
import { formatPkr } from '@/lib/format';
import { textDirection } from '@/lib/script';
import type { ScanCandidate } from '@/types/scan';

export interface AlternativesSheetProps {
  open: boolean;
  onClose: () => void;
  /** What the shopper wrote, shown so the choice has context. */
  rawText: string;
  candidates: ScanCandidate[];
  selectedProductId: string | null;
  onSelect: (candidate: ScanCandidate) => void;
}

/**
 * "Which one did you mean?" (§27)
 *
 * A bottom sheet on a phone, a centred dialog on a larger screen — the Modal
 * already handles that. The options are real radios inside a fieldset, so arrow
 * keys, the "2 of 3" announcement and the native focus ring all work; a list of
 * tappable divs would lose every one of them.
 *
 * Nothing is pre-selected when the shopper has not chosen yet. Highlighting the
 * server's favourite would turn "we are not sure" into an answer they might
 * accept without reading (§27).
 */
export function AlternativesSheet({
  open,
  onClose,
  rawText,
  candidates,
  selectedProductId,
  onSelect,
}: AlternativesSheetProps) {
  const direction = textDirection(rawText);

  return (
    <Modal open={open} onClose={onClose} title="Which one did you mean?" variant="sheet">
      <div className="gap-gutter flex flex-col">
        <p className="text-text-muted text-sm">
          You wrote{' '}
          <span lang={direction.lang} dir={direction.dir} className="text-text font-medium">
            {rawText}
          </span>
        </p>

        {candidates.length === 0 ? (
          <div className="gap-tight flex flex-col">
            <p className="text-text text-sm">
              We don&rsquo;t have anything matching this in the shop.
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <RadioCardGroup
            label="Choose the product you meant"
            hideLabel
            value={selectedProductId}
            onChange={(productId) => {
              const candidate = candidates.find((option) => option.productId === productId);
              if (candidate) onSelect(candidate);
            }}
          >
            {candidates.map((candidate) => (
              <RadioCard
                key={candidate.productId}
                value={candidate.productId}
                title={candidate.name}
                description={candidate.unitLabel + (candidate.brand ? ' · ' + candidate.brand : '')}
                trailing={
                  <span className="text-text font-semibold">{formatPkr(candidate.price)}</span>
                }
                icon={
                  <ProductImage
                    image={candidate.image}
                    name={candidate.name}
                    sizes="44px"
                    className="size-11 overflow-hidden rounded-full object-cover"
                  />
                }
                disabled={!candidate.isAvailable}
                // Disabled options still appear, so the shopper learns we
                // stock the thing rather than concluding we do not.
                disabledReason="Out of stock right now"
              >
                {candidate.isAvailable && candidate.availableQuantity <= 5 ? (
                  <span className="text-secondary text-xs">
                    Only {candidate.availableQuantity} left
                  </span>
                ) : null}
              </RadioCard>
            ))}
          </RadioCardGroup>
        )}
      </div>
    </Modal>
  );
}
