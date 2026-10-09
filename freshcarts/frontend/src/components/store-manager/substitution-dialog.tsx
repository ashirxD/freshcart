'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { SelectField, TextareaField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Money } from '@/components/common/ltr';
import {
  useProposeSubstitution,
  useStoreProducts,
} from '@/features/store-manager/store-manager.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
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
  const { t, tx } = useI18n();
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
      title={t('store.substitution.title')}
      description={t('store.substitution.description', {
        name: item.productName,
        quantity: item.quantity,
      })}
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
            {t('store.substitution.send')}
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <p className="bg-surface-muted text-text-muted p-tight rounded-md text-sm">
          {tx('store.substitution.priceRule', {
            amount: (
              <span className="text-text font-semibold">
                <Money>{formatPkr(chargedLineTotal)}</Money>
              </span>
            ),
          })}
        </p>

        <Input
          label={t('store.substitution.find')}
          placeholder={t('store.substitution.findPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SelectField
          label={t('store.substitution.product')}
          placeholder={isPending ? t('common.loading') : t('store.substitution.choose')}
          options={candidates.map((product) => ({
            value: product.id,
            label:
              product.name +
              ' · ' +
              product.unitLabel +
              ' · ' +
              formatPkr(product.sellingPrice) +
              ' · ' +
              t('store.substitution.optionStock', { count: product.stock.quantity }),
          }))}
          value={replacementId}
          onChange={(event) => setReplacementId(event.target.value)}
        />

        <Input
          label={t('common.quantity')}
          type="number"
          inputMode="numeric"
          min={1}
          placeholder={String(item.quantity)}
          hint={t('store.substitution.quantityHint', { quantity: item.quantity })}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />

        <SelectField
          label={t('store.substitution.why')}
          options={SUBSTITUTION_REASONS.map((option) => ({
            value: option.value,
            label: t(('store.substitutionReason.' + option.value) as TranslationKey),
          }))}
          value={reason}
          onChange={(event) => setReason(event.target.value as SubstitutionReason)}
        />

        <TextareaField
          label={t('store.substitution.note')}
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
              {tx('store.substitution.cataloguePrice', {
                quantity: replacementQuantity,
                price: (
                  <span className="text-text font-medium">
                    <Money>{formatPkr(catalogueLineTotal)}</Money>
                  </span>
                ),
              })}
              {catalogueLineTotal < chargedLineTotal ? (
                <span className="text-text-muted">
                  {' · '}
                  {tx('store.substitution.absorbs', {
                    amount: <Money>{formatPkr(chargedLineTotal - catalogueLineTotal)}</Money>,
                  })}
                </span>
              ) : null}
            </p>

            {tooExpensive ? (
              <Blocker>
                {tx('store.substitution.tooExpensive', {
                  name: <bdi>{selected.name}</bdi>,
                  price: <Money>{formatPkr(catalogueLineTotal)}</Money>,
                  charged: <Money>{formatPkr(chargedLineTotal)}</Money>,
                })}
              </Blocker>
            ) : null}

            {!dividesEvenly ? (
              <Blocker>
                {tx('store.substitution.notDivisible', {
                  charged: <Money>{formatPkr(chargedLineTotal)}</Money>,
                  quantity: replacementQuantity,
                })}
              </Blocker>
            ) : null}

            {notEnoughStock ? (
              <Blocker>
                {tx('store.substitution.notEnoughStock', {
                  available: selected.stock.quantity,
                  name: <bdi>{selected.name}</bdi>,
                })}
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
