'use client';

import { Info } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import type { Cart } from '@/types/cart';

export interface CartSummaryProps {
  cart: Cart;
  className?: string;
}

/**
 * The cart summary.
 *
 * Only the subtotal is shown, and it is the server's figure. The delivery
 * charge genuinely is not known here — it depends on a fulfilment choice and an
 * address the shopper has not made yet — so it says "calculated at checkout"
 * rather than guessing, showing zero, or implying free delivery (§42).
 *
 * The CTA is an anchor, not a button: it navigates. Wrapping a Button in a Link
 * would produce a `<button>` inside an `<a>`, which is invalid and genuinely
 * broken for assistive technology.
 */
export function CartSummary({ cart, className }: CartSummaryProps) {
  const canCheckout = !cart.hasIssues && cart.itemCount > 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-gutter rounded-lg border border-outline-variant bg-surface p-gutter shadow-card',
        className,
      )}
    >
      <h2 className="text-base font-semibold text-text">Order summary</h2>

      <dl className="flex flex-col gap-xs text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            Subtotal ({cart.totalQuantity === 1 ? '1 item' : cart.totalQuantity + ' items'})
          </dt>
          <dd className="font-semibold tabular-nums text-text">{formatPkr(cart.subtotal)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Delivery</dt>
          <dd className="text-text-muted">Calculated at checkout</dd>
        </div>
      </dl>

      {cart.hasIssues ? (
        <p
          role="status"
          className="flex items-start gap-1.5 rounded-md bg-surface-muted p-xs text-xs text-danger"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Some items need your attention before you can check out.
        </p>
      ) : null}

      {canCheckout ? (
        <ButtonLink href="/checkout" fullWidth size="lg">
          Continue to checkout
        </ButtonLink>
      ) : (
        <>
          {/*
            A disabled link is not a thing in HTML, and `pointer-events: none`
            still leaves it in the tab order announcing itself as a link that
            does nothing. So when checkout is genuinely unavailable the control
            is a real disabled button with the reason beside it.
          */}
          <button
            type="button"
            disabled
            aria-describedby="checkout-blocked-reason"
            className="inline-flex min-h-touch w-full cursor-not-allowed items-center justify-center rounded-full bg-primary px-lg text-base font-medium text-on-primary opacity-50"
          >
            Continue to checkout
          </button>

          <p id="checkout-blocked-reason" className="text-center text-xs text-text-muted">
            {cart.itemCount === 0
              ? 'Add something to your cart to continue.'
              : 'Fix the items above to continue.'}
          </p>
        </>
      )}

      <p className="text-center text-xs text-text-muted">
        You will see the delivery charge and your total before placing the order.
      </p>
    </div>
  );
}
