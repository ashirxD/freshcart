'use client';

import { useState } from 'react';
import { Replace } from 'lucide-react';
import { Ltr, Money } from '@/components/common/ltr';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import type { StoreOrderDetail, StoreOrderItem, Substitution } from '@/types/store-manager';

export interface PickingListProps {
  order: StoreOrderDetail;
  /** Only offered while the order is still in the editable window. */
  onSubstitute?: (item: StoreOrderItem) => void;
}

/**
 * The picking list.
 *
 * The tick boxes are deliberately local component state and nothing else. §20
 * says as much, and the reason is worth being explicit about: the checklist is a
 * memory aid for whoever is walking the aisles, not a business record. Persisting
 * it would invite the backend to trust it — and "the picker ticked everything"
 * is not evidence that the items are in the bag. `Mark packed` is validated
 * against the order's *status*, which is a fact the server owns.
 *
 * Which means: a refresh clears the ticks, and that is correct. Nothing depends
 * on them.
 */
export function PickingList({ order, onSubstitute }: PickingListProps) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const isPicking = order.status === 'PREPARING';
  const allPicked = order.items.every((item) => picked.has(item.productId));

  const openSubstitution = (productId: string) =>
    order.substitutions.find(
      (substitution) =>
        substitution.status === 'PROPOSED' && substitution.original.productId === productId,
    );

  const toggle = (productId: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });

  return (
    <section className="gap-gutter flex flex-col" aria-labelledby="items-heading">
      <div className="gap-gutter flex flex-wrap items-center justify-between">
        <h2 id="items-heading" className="text-text text-base font-semibold">
          {t('store.picking.items')}
          <span className="text-text-muted ms-2 text-sm font-normal">
            {t('store.picking.lines', { count: order.items.length })} ·{' '}
            {t('store.picking.units', { count: order.totalQuantity })}
          </span>
        </h2>

        {isPicking ? (
          <p
            aria-live="polite"
            className={cn('text-sm', allPicked ? 'text-success' : 'text-text-muted')}
          >
            {t('store.picking.pickedOf', { picked: picked.size, total: order.items.length })}
          </p>
        ) : null}
      </div>

      <ul className="ring-outline-variant divide-outline-variant bg-surface divide-y overflow-hidden rounded-2xl ring-1">
        {order.items.map((item) => {
          const substitution = openSubstitution(item.productId);

          return (
            <li key={item.productId} className="gap-gutter p-gutter flex items-start">
              {isPicking ? (
                <label className="min-h-touch flex shrink-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={picked.has(item.productId)}
                    onChange={() => toggle(item.productId)}
                    className="size-5 accent-[var(--color-primary)]"
                  />
                  <span className="sr-only">
                    {t('store.picking.markPicked', { name: item.productName })}
                  </span>
                </label>
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p
                  className={cn(
                    'text-text font-medium',
                    isPicking && picked.has(item.productId) && 'text-text-muted line-through',
                  )}
                >
                  <bdi>{item.productName}</bdi>
                </p>

                <p className="text-text-muted text-sm">
                  <Ltr>{item.sku}</Ltr> · {item.unitLabel}
                  {item.brand ? (
                    <>
                      {' · '}
                      <bdi>{item.brand}</bdi>
                    </>
                  ) : null}
                </p>

                {substitution ? <SubstitutionNotice substitution={substitution} /> : null}
              </div>

              <div className="gap-tight flex shrink-0 flex-col items-end">
                <span className="text-text text-lg font-bold tabular-nums">
                  <Ltr>× {item.quantity}</Ltr>
                </span>
                <span className="text-text-muted text-sm tabular-nums">
                  <Money>{formatPkr(item.lineTotal)}</Money>
                </span>

                {onSubstitute && !substitution ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSubstitute(item)}
                    leadingIcon={<Replace className="size-4" aria-hidden="true" />}
                    aria-label={t('store.picking.replaceAria', { name: item.productName })}
                  >
                    {t('store.picking.replace')}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {order.customerNote ? (
        <p className="bg-apricot/15 text-text p-gutter rounded-xl text-sm">
          <span className="font-semibold">{t('store.picking.customerNote')} </span>
          <bdi>{order.customerNote}</bdi>
        </p>
      ) : null}
    </section>
  );
}

/** A pending replacement, shown against the line it applies to. */
function SubstitutionNotice({ substitution }: { substitution: Substitution }) {
  const { tx } = useI18n();

  return (
    <p className="bg-secondary-container/25 text-secondary mt-1 rounded-md px-2 py-1 text-xs font-medium">
      {tx('store.picking.offered', {
        name: <bdi>{substitution.replacement.productName}</bdi>,
        quantity: substitution.replacement.quantity,
      })}
    </p>
  );
}
