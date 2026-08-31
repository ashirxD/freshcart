'use client';

import { AlertTriangle, Check, HelpCircle, PackageX, Search, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { QuantitySelector } from '@/components/common/quantity-selector';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/components/product/product-image';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import { textDirection } from '@/lib/script';
import type { SelectionLine } from '@/features/scan/use-scan-selection';

export interface OcrItemCardProps {
  line: SelectionLine;
  onChangeProduct: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onRestore: () => void;
}

/**
 * ONE card for every state a scanned line can be in (§26).
 *
 * Matched, ambiguous, not-found, sold-out and removed are five appearances of
 * the same component, driven by props — not five components. The alternative
 * drifts within a week: the "matched" card grows a feature the "ambiguous" one
 * silently lacks, and a shopper meets two different interfaces for the same
 * decision.
 *
 * Every state shows the shopper's own words at the top. That is what makes a
 * wrong match explainable rather than mysterious (§10), and it is set with the
 * right `lang`/`dir` so an Urdu list reads as Urdu (§50).
 */
export function OcrItemCard({
  line,
  onChangeProduct,
  onQuantityChange,
  onRemove,
  onRestore,
}: OcrItemCardProps) {
  const { item, chosen, quantity, removed, addedToCart } = line;
  const status = chosen ? 'MATCHED' : item.match.status;
  const soldOut = chosen !== null && !chosen.isAvailable;

  if (addedToCart) {
    return (
      <li className="border-primary/30 bg-primary/5 gap-gutter p-gutter flex items-center justify-between rounded-lg border">
        <p className="text-text-muted text-sm">
          <Check className="text-primary mr-1 inline size-4" aria-hidden="true" />
          Added <span className="text-text font-medium">{chosen?.name}</span> ×{quantity}
        </p>
      </li>
    );
  }

  if (removed) {
    return (
      <li className="border-outline-variant bg-surface-muted gap-gutter p-gutter flex items-center justify-between rounded-lg border border-dashed">
        <p className="text-text-muted text-sm">
          Removed <RawText text={item.source.rawText} className="font-medium" />
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRestore}
          leadingIcon={<Undo2 className="size-4" />}
        >
          Undo
        </Button>
      </li>
    );
  }

  return (
    <li
      className={cn(
        'border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border',
        soldOut && 'border-danger/40',
      )}
    >
      <div className="gap-xs flex items-start justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-text-muted text-xs">You wrote</p>
          <RawText text={item.source.rawText} className="text-text truncate text-sm font-medium" />
        </div>

        <StatusChip status={soldOut ? 'SOLD_OUT' : status} />
      </div>

      {chosen ? (
        <div className="gap-gutter flex items-start">
          <ProductImage
            image={chosen.image}
            name={chosen.name}
            sizes="64px"
            className="size-16 shrink-0 overflow-hidden rounded-md object-cover"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-text truncate text-base font-semibold">{chosen.name}</p>
            <p className="text-text-muted text-sm">
              {chosen.unitLabel}
              {chosen.brand ? ' · ' + chosen.brand : ''}
            </p>
            <p className="text-text text-sm font-semibold">
              {formatPkr(chosen.price)}
              {quantity > 1 ? (
                <span className="text-text-muted font-normal">
                  {' '}
                  × {quantity} = {formatPkr(chosen.price * quantity)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : (
        <UndecidedBody status={item.match.status} rawText={item.source.rawText} />
      )}

      <Notices line={line} soldOut={soldOut} />

      <div className="gap-xs flex flex-wrap items-center justify-between">
        {chosen && !soldOut ? (
          <QuantitySelector
            value={quantity}
            onChange={onQuantityChange}
            max={chosen.availableQuantity}
            size="sm"
            label={'quantity of ' + chosen.name}
          />
        ) : (
          <span />
        )}

        <div className="gap-xs flex items-center">
          {/* §49: a word, never only a pencil icon. */}
          {chosen || item.alternatives.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onChangeProduct}>
              {chosen ? 'Change product' : 'Choose a product'}
            </Button>
          ) : null}

          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

/** The shopper's own words, rendered in their own script. */
function RawText({ text, className }: { text: string; className?: string }) {
  const direction = textDirection(text);

  return (
    <span lang={direction.lang} dir={direction.dir} className={className}>
      {text}
    </span>
  );
}

/**
 * Status, communicated by icon AND word (§49).
 *
 * Never by colour alone: a red border says nothing to a shopper who cannot
 * distinguish it, and nothing at all to a screen reader.
 */
function StatusChip({
  status,
}: {
  status: 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'INVALID' | 'SOLD_OUT';
}) {
  const config = {
    MATCHED: { label: 'Found', icon: Check, className: 'bg-primary/10 text-primary' },
    AMBIGUOUS: {
      label: 'Needs a choice',
      icon: HelpCircle,
      className: 'bg-secondary-container/40 text-secondary',
    },
    NOT_FOUND: { label: 'Not found', icon: Search, className: 'bg-surface-sunken text-text-muted' },
    INVALID: {
      label: 'Not clear',
      icon: AlertTriangle,
      className: 'bg-surface-sunken text-text-muted',
    },
    SOLD_OUT: { label: 'Out of stock', icon: PackageX, className: 'bg-danger/10 text-danger' },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
        config.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function UndecidedBody({ status, rawText }: { status: string; rawText: string }) {
  if (status === 'AMBIGUOUS') {
    // §27's exact wording. Honest about the uncertainty rather than guessing.
    return <p className="text-text text-sm">We&rsquo;re not sure which product you mean.</p>;
  }

  return (
    <div className="gap-xs flex flex-col">
      <p className="text-text text-sm">We couldn&rsquo;t find this item.</p>
      {/* §28: give them somewhere to go rather than a dead end. */}
      <Link
        href={'/search?q=' + encodeURIComponent(rawText)}
        className="text-primary text-sm font-medium underline underline-offset-2"
      >
        Search for it yourself
      </Link>
    </div>
  );
}

/** Things the shopper needs to know about this line, in plain words. */
function Notices({ line, soldOut }: { line: SelectionLine; soldOut: boolean }) {
  const notices: string[] = [];

  if (soldOut) {
    notices.push('This is out of stock right now, so it will not be added.');
  } else if (line.cappedByStock && line.chosen) {
    // §33: say how many there are, so the number can be changed rather than
    // merely refused.
    notices.push(
      'You asked for ' +
        line.item.source.quantity +
        ', but only ' +
        line.chosen.availableQuantity +
        ' ' +
        (line.chosen.availableQuantity === 1 ? 'is' : 'are') +
        ' available.',
    );
  }

  if (line.item.source.quantityAdjusted) {
    notices.push('We could not read the quantity clearly, so we set it to ' + line.quantity + '.');
  }

  // §22: when the shopper named a size we could not match exactly, say so
  // rather than quietly buying a different pack.
  if (line.chosen && line.item.source.unit && !line.chosen.unitMatches) {
    notices.push(
      'You wrote ' +
        (line.item.source.unitValue ?? '') +
        ' ' +
        line.item.source.unit +
        '. This comes as ' +
        line.chosen.unitLabel +
        '.',
    );
  }

  if (notices.length === 0) return null;

  return (
    <ul className="text-text-muted flex flex-col gap-1 text-xs">
      {notices.map((notice) => (
        <li key={notice} className="flex items-start gap-1.5">
          <AlertTriangle className="text-secondary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {notice}
        </li>
      ))}
    </ul>
  );
}
