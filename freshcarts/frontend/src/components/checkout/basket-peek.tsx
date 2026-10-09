import { Bike } from 'lucide-react';
import { ProductImage } from '@/components/product/product-image';
import { Money } from '@/components/common/ltr';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr, productTint } from '@/lib/format';
import type { Cart } from '@/types/cart';

/** Enough lines to recognise the order by; the rest are counted, not listed. */
const LINES_SHOWN = 4;

export interface BasketPeekProps {
  cart: Cart;
  className?: string;
}

/**
 * WHAT YOU ARE ORDERING, BEFORE THE DELIVERY CHARGE EXISTS
 *
 * A delivery order cannot be priced until the shopper has chosen an address —
 * routing is what produces the charge — so for the first step or two the order
 * summary has nothing to show, and the side rail used to be a single grey hint.
 * That left the one screen where a shopper is about to commit money without any
 * sight of what they are committing to.
 *
 * This is the basket as the API already priced it. Every figure is the cart's
 * own: line totals and the subtotal come from the server, and nothing here adds,
 * multiplies or estimates. The delivery charge is deliberately NOT a number —
 * it says plainly that it is worked out next — so nothing resembling a total
 * can appear before the real one does. Once an address is chosen, the full
 * `OrderSummaryPanel` takes this place.
 */
export function BasketPeek({ cart, className }: BasketPeekProps) {
  const t = useT();
  const lines = cart.items.filter((item) => item.product !== null);
  const shown = lines.slice(0, LINES_SHOWN);
  const hidden = lines.length - shown.length;

  return (
    <section
      aria-labelledby="basket-peek-heading"
      className={cn(
        'gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1',
        className,
      )}
    >
      <h2 id="basket-peek-heading" className="text-text text-base font-bold tracking-[-0.015em]">
        {t('checkout.peek.title')}
      </h2>

      <ul className="gap-gutter flex list-none flex-col">
        {shown.map((item) => {
          const product = item.product;
          if (!product) return null;

          return (
            <li key={item.productId} className="gap-tight flex items-start">
              <div
                className={cn(
                  'relative size-12 shrink-0 overflow-hidden rounded-lg',
                  productTint(product.name),
                )}
              >
                <ProductImage
                  image={product.primaryImage}
                  name={product.name}
                  sizes="48px"
                  className="size-full p-0.5"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-text truncate text-sm font-medium">{product.name}</span>
                <span className="text-text-muted text-xs">
                  {product.unitLabel} × {item.quantity}
                </span>
              </div>

              <span className="text-text shrink-0 text-sm font-semibold tabular-nums">
                <Money>{formatPkr(item.lineTotal)}</Money>
              </span>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <p className="text-text-muted -mt-1 text-xs font-medium">
          {t('checkout.peek.more', { count: hidden })}
        </p>
      ) : null}

      <dl className="gap-tight border-outline-variant pt-gutter flex flex-col border-t text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            {t('checkout.summary.subtotalItems', {
              items: t('common.itemCount', { count: cart.totalQuantity }),
            })}
          </dt>
          <dd className="text-text font-semibold tabular-nums">
            <Money>{formatPkr(cart.subtotal)}</Money>
          </dd>
        </div>
      </dl>

      <p className="bg-surface-muted text-text-muted gap-tight flex items-start rounded-xl p-3 text-xs leading-relaxed">
        <Bike className="text-leaf mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('checkout.peek.note')}
      </p>
    </section>
  );
}
