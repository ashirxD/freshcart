'use client';

import Link from 'next/link';
import { AlertCircle, Trash2 } from 'lucide-react';
import { QuantitySelector } from '@/components/common/quantity-selector';
import { PriceDisplay } from '@/components/product/price-display';
import { ProductImage } from '@/components/product/product-image';
import { useRemoveCartItem, useUpdateCartItem } from '@/features/cart/cart.hooks';
import { formatPkr } from '@/lib/format';
import type { CartItem, CartItemIssue } from '@/types/cart';

/** Plain-language explanation for each thing that can go wrong with a line. */
const ISSUE_MESSAGES: Record<CartItemIssue, string> = {
  UNAVAILABLE: 'No longer available. Remove it to continue.',
  OUT_OF_STOCK: 'Out of stock right now. Remove it or try again later.',
  QUANTITY_REDUCED: 'Not enough left in stock — lower the quantity to continue.',
};

export function CartItemRow({ item }: { item: CartItem }) {
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  const isPending = updateItem.isPending || removeItem.isPending;
  const name = item.product?.name ?? 'This product';

  return (
    <li className="gap-gutter py-gutter flex">
      <div className="bg-surface-muted relative size-20 shrink-0 overflow-hidden rounded-md">
        <ProductImage
          image={item.product?.primaryImage ?? null}
          name={name}
          sizes="80px"
          className="size-full"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            {item.product?.brand ? (
              <span className="text-text-muted truncate text-xs">{item.product.brand}</span>
            ) : null}

            <h3 className="text-text text-sm font-semibold">
              {item.product ? (
                <Link href={'/products/' + item.product.slug} className="hover:text-primary">
                  {item.product.name}
                </Link>
              ) : (
                name
              )}
            </h3>

            {item.product ? (
              <span className="text-text-muted text-xs">{item.product.unitLabel}</span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => removeItem.mutate(item.productId)}
            disabled={isPending}
            aria-label={'Remove ' + name + ' from your cart'}
            className="text-outline hover:bg-surface-muted hover:text-danger -me-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        {item.issue ? (
          <p className="text-danger flex items-start gap-1.5 text-xs font-medium">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {ISSUE_MESSAGES[item.issue]}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <QuantitySelector
            value={item.quantity}
            max={item.maxQuantity || undefined}
            size="sm"
            removable
            disabled={isPending || item.issue === 'UNAVAILABLE'}
            label={'quantity of ' + name}
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
                <PriceDisplay
                  sellingPrice={item.product.sellingPrice}
                  compareAtPrice={item.product.compareAtPrice}
                  size="sm"
                  className="justify-end"
                />
                {/* The line total is the server's figure, never a local
                    multiplication, so it always matches the subtotal. */}
                <p className="text-text text-sm font-semibold tabular-nums">
                  {formatPkr(item.lineTotal)}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
