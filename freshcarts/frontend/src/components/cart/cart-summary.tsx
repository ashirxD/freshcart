'use client';

import { Info, ShieldCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { Money } from '@/components/common/ltr';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr, formatPkrLabel } from '@/lib/format';
import type { Cart } from '@/types/cart';

export interface CartSummaryProps {
  cart: Cart;
  className?: string;
}

/**
 * The basket summary.
 *
 * Only the subtotal is shown, and it is the server's figure. The delivery
 * charge genuinely is not known here — it depends on a fulfilment choice and an
 * address the shopper has not made yet — so it says "worked out at checkout"
 * rather than guessing, showing zero, or implying free delivery.
 *
 * HIERARCHY (§33, §80)
 * The subtotal is the largest thing in the card and sits on its own tinted row,
 * because "what will this cost me" is the only question this panel answers. The
 * CTA is directly beneath it, and everything else — the delivery note, the
 * reassurance line — is small print underneath.
 *
 * The CTA is an anchor, not a button: it navigates. Wrapping a Button in a Link
 * would produce a `<button>` inside an `<a>`, which is invalid and genuinely
 * broken for assistive technology.
 */
export function CartSummary({ cart, className }: CartSummaryProps) {
  const t = useT();
  const canCheckout = !cart.hasIssues && cart.itemCount > 0;

  return (
    <div
      className={cn(
        'gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1',
        className,
      )}
    >
      <h2 className="text-text text-base font-bold tracking-[-0.015em]">
        {t('cart.summaryTitle')}
      </h2>

      <dl className="gap-tight flex flex-col text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">
            {t('common.itemCount', { count: cart.totalQuantity })}
          </dt>
          <dd className="text-text font-semibold tabular-nums">
            <Money>{formatPkr(cart.subtotal)}</Money>
          </dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-text-muted">{t('cart.delivery')}</dt>
          <dd className="text-text-muted text-xs">{t('cart.workedOutAtCheckout')}</dd>
        </div>
      </dl>

      {/* The number the shopper came here for, on its own ground. */}
      <div className="bg-cream ring-sand flex items-baseline justify-between rounded-xl px-3 py-2.5 ring-1">
        <span className="text-text text-sm font-bold">{t('common.subtotal')}</span>
        <span
          className="text-primary text-price-lg tabular-nums"
          aria-label={t('cart.subtotalAria', { amount: formatPkrLabel(cart.subtotal, t) })}
        >
          <Money>{formatPkr(cart.subtotal)}</Money>
        </span>
      </div>

      {cart.hasIssues ? (
        <p
          role="status"
          className="text-danger bg-danger/8 p-tight flex items-start gap-1.5 rounded-lg text-xs font-medium"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t('cart.needsAttention')}
        </p>
      ) : null}

      {canCheckout ? (
        <ButtonLink href="/checkout" fullWidth size="lg">
          {t('cart.checkout')}
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
            className="bg-primary text-on-primary min-h-touch px-wide flex h-14 w-full cursor-not-allowed items-center justify-center rounded-lg text-base font-semibold opacity-45"
          >
            {t('cart.checkout')}
          </button>

          <p id="checkout-blocked-reason" className="text-text-muted text-center text-xs">
            {cart.itemCount === 0 ? t('cart.addSomething') : t('cart.fixItems')}
          </p>
        </>
      )}

      <p className="text-text-muted flex items-start gap-1.5 text-xs">
        <ShieldCheck className="text-leaf mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t('cart.seeCharge')}
      </p>
    </div>
  );
}
