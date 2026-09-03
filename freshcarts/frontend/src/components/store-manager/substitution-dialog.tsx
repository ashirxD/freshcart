'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { SelectField, TextareaField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  useProposeSubstitution,
  useStoreProducts,
} from '@/features/store-manager/store-manager.hooks';
import { formatPkr } from '@/lib/format';
import { SUBSTITUTION_REASONS } from '@/types/store-manager';
import type { StoreOrderItem, SubstitutionReason } from '@/types/store-manager';

export interface SubstitutionDialogProps {
  orderId: string;
  item: StoreOrderItem | null;
  onClose: () => void;
}

/**
 * Proposing a replacement for one line.
 *
 * The price rule is stated on screen rather than left to be discovered: the
 * customer pays what they already agreed, whatever the replacement costs, and a
 * dearer replacement is refused by the server. Showing that up front is what
 * stops a picker choosing something they cannot offer and then reading an error.
 *
 * Nothing here computes a price. The catalogue price comes from the product list
 * and the charged total comes from the order line; the server re-reads both.
 */
export function SubstitutionDialog({ orderId, item, onClose }: SubstitutionDialogProps) {
  const [search, setSearch] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<SubstitutionReason>('OUT_OF_STOCK');
  const [note, setNote] = useState('');

  const propose = useProposeSubstitution(onClose);
  const { data: products, isPending } = useStoreProducts({
    search: search || undefined,
    limit: 30,
  });

  if (!item) return null;

  const chargedLineTotal = item.lineTotal;
  const replacementQuantity = Number.parseInt(quantity, 10) || item.quantity;

  const candidates = (products?.items ?? []).filter(
    (product) => product.id !== item.productId && product.isActive && product.stock.isAvailable,
  );

  const selected = candidates.find((product) => product.id === replacementId);

  const catalogueLineTotal = selected ? selected.sellingPrice * replacementQuantity : 0;
  const tooExpensive = Boolean(selected) && catalogueLineTotal > chargedLineTotal;
  const dividesEvenly = chargedLineTotal % replacementQuantity === 0;
  const notEnoughStock = Boolean(selected) && (selected?.stock.quantity ?? 0) < replacementQuantity;

  const canSubmit =
    Boolean(selected) && !tooExpensive && dividesEvenly && !notEnoughStock && !propose.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title="Offer a replacement"
      description={'Replacing ' + item.productName + ' (× ' + item.quantity + ')'}
      footer={
        <div className="gap-gutter flex">
          <Button
            fullWidth
            isLoading={propose.isPending}
            disabled={!canSubmit}
            onClick={() =>
              selected &&
              propose.mutate({
                orderId,
                productId: item.productId,
                replacementProductId: selected.id,
                replacementQuantity,
                reason,
                note: note.trim() || undefined,
              })
            }
          >
            Send to customer
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <p className="bg-surface-muted text-text-muted p-tight rounded-md text-sm">
          The customer keeps paying{' '}
          <span className="text-text font-semibold">{formatPkr(chargedLineTotal)}</span> for this
          line. A replacement may cost the same or less — never more.
        </p>

        <Input
          label="Find a replacement"
          placeholder="Search by name or item code"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SelectField
          label="Replacement product"
          placeholder={isPending ? 'Loading…' : 'Choose a product'}
          options={candidates.map((product) => ({
            value: product.id,
            label:
              product.name +
              ' · ' +
              product.unitLabel +
              ' · ' +
              formatPkr(product.sellingPrice) +
              ' · ' +
              product.stock.quantity +
              ' in stock',
          }))}
          value={replacementId}
          onChange={(event) => setReplacementId(event.target.value)}
        />

        <Input
          label="Quantity"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder={String(item.quantity)}
          hint={'Defaults to ' + item.quantity + ', the quantity ordered.'}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />

        <SelectField
          label="Why is the original unavailable?"
          options={SUBSTITUTION_REASONS.map((option) => ({ ...option }))}
          value={reason}
          onChange={(event) => setReason(event.target.value as SubstitutionReason)}
        />

        <TextareaField
          label="Note to the customer (optional)"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {/*
          Every blocker the server would return, checked here too so the picker
          sees it before sending rather than after. The server remains the
          authority — this only saves a round trip and a confusing error.
        */}
        {selected ? (
          <div className="gap-tight flex flex-col text-sm">
            <p className="text-text-muted">
              Catalogue price for {replacementQuantity} ×{' '}
              <span className="text-text font-medium">{formatPkr(catalogueLineTotal)}</span>
              {catalogueLineTotal < chargedLineTotal ? (
                <span className="text-text-muted">
                  {' '}
                  · store absorbs {formatPkr(chargedLineTotal - catalogueLineTotal)}
                </span>
              ) : null}
            </p>

            {tooExpensive ? (
              <Blocker>
                {selected.name} costs {formatPkr(catalogueLineTotal)}, more than the{' '}
                {formatPkr(chargedLineTotal)} the customer agreed to. Choose something at the same
                price or less, or reject the order.
              </Blocker>
            ) : null}

            {!dividesEvenly ? (
              <Blocker>
                {formatPkr(chargedLineTotal)} does not divide evenly into {replacementQuantity}{' '}
                units, so the line total would not add up. Try another quantity.
              </Blocker>
            ) : null}

            {notEnoughStock ? (
              <Blocker>
                Only {selected.stock.quantity} of {selected.name} in stock.
              </Blocker>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Blocker({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-danger flex items-start gap-1.5 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
