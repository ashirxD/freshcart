'use client';

import { useState } from 'react';
import { SelectField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockHistory, useUpdateStock } from '@/features/store-manager/store-manager.hooks';
import { STOCK_CHANGE_REASONS } from '@/types/store-manager';
import type { StockChangeReason, StoreInventoryRow } from '@/types/store-manager';

/**
 * An absolute stock set, with a reason.
 *
 * Confirmed in a dialog rather than edited inline because "set to" overwrites
 * whatever is there — §43 asks for confirmation on a large inventory
 * adjustment, and a stock take is always one.
 *
 * The reason is asked for here because it is what makes the audit row worth
 * keeping: "who set this to 4, and why" is the question a manager actually has
 * when a count looks wrong.
 */
export function SetStockDialog({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: StoreInventoryRow;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [threshold, setThreshold] = useState(String(row.lowStockThreshold));
  const [reason, setReason] = useState<StockChangeReason>('CORRECTION');
  const [note, setNote] = useState('');

  const update = useUpdateStock(onClose);

  if (!open) return null;

  const parsedQuantity = Number.parseInt(quantity, 10);
  const parsedThreshold = Number.parseInt(threshold, 10);

  const isValid =
    Number.isFinite(parsedQuantity) &&
    parsedQuantity >= 0 &&
    Number.isFinite(parsedThreshold) &&
    parsedThreshold >= 0;

  const delta = parsedQuantity - row.quantity;

  return (
    <Modal
      open
      onClose={onClose}
      title="Set stock"
      description={row.productName + ' · ' + row.quantity + ' on hand now'}
      footer={
        <div className="gap-gutter flex">
          <Button
            fullWidth
            isLoading={update.isPending}
            disabled={!isValid}
            onClick={() =>
              update.mutate({
                productId: row.productId,
                quantity: parsedQuantity,
                lowStockThreshold: parsedThreshold,
                changeReason: reason,
                reason: note.trim() || undefined,
              })
            }
          >
            Save
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <Input
          label="Quantity on hand"
          type="number"
          inputMode="numeric"
          min={0}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />

        <Input
          label="Warn when stock reaches"
          type="number"
          inputMode="numeric"
          min={0}
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
        />

        <SelectField
          label="Reason"
          hint="Recorded against your name in the stock history."
          options={STOCK_CHANGE_REASONS.map((option) => ({ ...option }))}
          value={reason}
          onChange={(event) => setReason(event.target.value as StockChangeReason)}
        />

        <Input
          label="Note (optional)"
          placeholder="e.g. delivery 40 crates"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {isValid && delta !== 0 ? (
          <p aria-live="polite" className="text-text-muted text-sm">
            This will {delta > 0 ? 'add ' + delta : 'remove ' + Math.abs(delta)} unit
            {Math.abs(delta) === 1 ? '' : 's'}.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** The audit trail for one product (§34). */
export function StockHistoryDialog({
  row,
  onClose,
}: {
  row: StoreInventoryRow | null;
  onClose: () => void;
}) {
  const { data, isPending } = useStockHistory(row?.productId ?? null);

  if (!row) return null;

  return (
    <Modal open onClose={onClose} title="Stock history" description={row.productName}>
      {isPending ? (
        <Skeleton className="h-32 w-full" label="Loading stock history" />
      ) : data && data.length > 0 ? (
        <ol className="gap-gutter flex list-none flex-col">
          {data.map((entry, index) => (
            <li key={index} className="gap-0.5 flex flex-col text-sm">
              <span className="text-text font-medium tabular-nums">
                {entry.previousQuantity} → {entry.newQuantity} ({entry.delta > 0 ? '+' : ''}
                {entry.delta})
              </span>
              <span className="text-text-muted text-xs">
                {entry.reason.toLowerCase()} ·{' '}
                <time dateTime={entry.changedAt}>
                  {new Date(entry.changedAt).toLocaleString('en-PK')}
                </time>
                {' · '}
                {entry.changedByRole === 'STORE_MANAGER' ? 'Store' : entry.changedByRole}
              </span>
              {entry.note ? <span className="text-text-muted text-xs">{entry.note}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-text-muted text-sm">
          No stock changes have been recorded for this product yet.
        </p>
      )}
    </Modal>
  );
}
