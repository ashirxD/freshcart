'use client';

import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import { useToast } from '@/store/toast.store';
import type { Cart } from '@/types/cart';

export interface CartSummaryProps {
  cart: Cart;
  className?: string;
}

/**
 * The order summary.
 *
 * Only the subtotal is shown, and it is the server's figure. Delivery is
 * calculated at checkout in a later milestone, so inventing a fee — or a total
 * that pretends to include one — would be a number the shopper cannot trust.
 */
export function CartSummary({ cart, className }: CartSummaryProps) {
  const toast = useToast();

  return (
    <div
      className={cn(
        'gap-gutter border-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-lg border',
        className,
      )}
    >
      <h2 className="text-text text-base font-semibold">Order summary</h2>

      <dl className="gap-xs flex flex-col text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            Subtotal ({cart.totalQuantity === 1 ? '1 item' : cart.totalQuantity + ' items'})
          </dt>
          <dd className="text-text font-semibold tabular-nums">{formatPkr(cart.subtotal)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Delivery</dt>
          <dd className="text-text-muted">Calculated at checkout</dd>
        </div>
      </dl>

      {cart.hasIssues ? (
        <p
          role="status"
          className="bg-surface-muted p-xs text-danger flex items-start gap-1.5 rounded-md text-xs"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Some items need your attention before you can check out.
        </p>
      ) : null}

      {/*
        Checkout belongs to a later milestone. Rather than a button that leads
        nowhere or a fake flow, this states plainly where things stand — and it
        is disabled while any line has a problem, which will be a real
        precondition when checkout does arrive.
      */}
      <Button
        fullWidth
        size="lg"
        disabled={cart.hasIssues || cart.itemCount === 0}
        onClick={() =>
          toast({
            title: 'Checkout is coming soon',
            description: 'Your cart is saved. Delivery and payment arrive in the next release.',
            variant: 'info',
          })
        }
      >
        Continue to checkout
      </Button>

      <p className="text-text-muted text-center text-xs">
        Delivery and payment options arrive in the next release.
      </p>
    </div>
  );
}
