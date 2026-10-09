'use client';

import Link from 'next/link';
import { AlertCircle, Trash2 } from 'lucide-react';
import { QuantitySelector } from '@/components/common/quantity-selector';
import { PriceDisplay } from '@/components/product/price-display';
import { ProductImage } from '@/components/product/product-image';
import { useRemoveCartItem, useUpdateCartItem } from '@/features/cart/cart.hooks';
import { Money } from '@/components/common/ltr';
import { useT, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr, productTint } from '@/lib/format';
import type { CartItem, CartItemIssue } from '@/types/cart';

/** Plain-language explanation for each thing that can go wrong with a line. */
const ISSUE_MESSAGES: Record<CartItemIssue, TranslationKey> = {
  UNAVAILABLE: 'cart.issueUnavailable',
  OUT_OF_STOCK: 'cart.issueOutOfStock',
  QUANTITY_REDUCED: 'cart.issueReduced',
};

/**
 * One line in the basket.
 *
 * A row with a problem gets a tomato-tinted ground and a hairline, so a shopper
 * scanning a long basket can see which line is holding up checkout without
 * reading every one of them. That is a colour AND a message AND an icon — the
 * message is what carries the meaning.
 */
export function CartItemRow({ item }: { item: CartItem }) {
  const t = useT();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  const isPending = updateItem.isPending || removeItem.isPending;
  const name = item.product?.name ?? t('cart.thisProduct');
  const hasIssue = Boolean(item.issue);

  return (
    <li
      className={cn(
        'gap-gutter p-gutter flex transition-colors duration-200',
        hasIssue && 'bg-danger/4',
      )}
    >
      <div
        className={cn('relative size-20 shrink-0 overflow-hidden rounded-xl', productTint(name))}
      >
        <ProductImage
          image={item.product?.primaryImage ?? null}
          name={name}
          sizes="80px"
          className="size-full p-1.5"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            {item.product?.brand ? (
              <span className="text-text-muted truncate text-[0.6875rem] font-bold tracking-[0.04em] uppercase">
                {item.product.brand}
              </span>
            ) : null}

            <h3 className="text-text text-card">
              {item.product ? (
                <Link
                  href={'/products/' + item.product.slug}
                  className="hover:text-primary transition-colors"
                >
                  {item.product.name}
                </Link>
              ) : (
                name
              )}
            </h3>

            {item.product ? (
              <span className="text-text-muted text-xs font-medium">{item.product.unitLabel}</span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => removeItem.mutate(item.productId)}
            disabled={isPending}
            aria-label={t('cart.removeFromBasket', { name })}
            className="text-outline hover:bg-danger/8 hover:text-danger -me-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        {item.issue ? (
          <p className="text-danger flex items-start gap-1.5 text-xs font-semibold">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t(ISSUE_MESSAGES[item.issue])}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1.5">
          <QuantitySelector
            value={item.quantity}
            max={item.maxQuantity || undefined}
            size="sm"
            removable
            disabled={isPending || item.issue === 'UNAVAILABLE'}
            itemName={name}
            onChange={(quantity) => {
              if (quantity <= 0) {
                removeItem.mutate(item.productId);
                return;
              }
              updateItem.mutate({ productId: item.productId, quantity });
            }}
          />

          <div className="text-end">
            {item.product ? (
              <>
                {/* The line total is the server's figure, never a local
                    multiplication, so it always matches the subtotal. It is
                    also the biggest number on the row: it is what this line
                    costs, and the unit price is the supporting detail. */}
                <p className="text-text text-price tabular-nums">
                  <Money>{formatPkr(item.lineTotal)}</Money>
                </p>

                {item.quantity > 1 ? (
                  <PriceDisplay
                    sellingPrice={item.product.sellingPrice}
                    compareAtPrice={item.product.compareAtPrice}
                    size="sm"
                    className="justify-end opacity-70"
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
