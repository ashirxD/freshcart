'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, UserRound } from 'lucide-react';
import { AddressPicker } from '@/components/address/address-picker';
import { CheckoutProblem } from '@/components/checkout/checkout-problem';
import { CheckoutSteps } from '@/components/checkout/checkout-steps';
import { FulfillmentSelector } from '@/components/checkout/fulfillment-selector';
import { OrderSummaryPanel } from '@/components/checkout/order-summary-panel';
import { PaymentSelector } from '@/components/checkout/payment-selector';
import { ReviewStep } from '@/components/checkout/review-step';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/features/cart/cart.hooks';
import {
  useAcceptPriceChanges,
  useCheckoutPreview,
  usePlaceOrder,
} from '@/features/checkout/checkout.hooks';
import { useIdempotencyKey } from '@/features/checkout/use-idempotency-key';
import { formatPkr } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import type { CheckoutPreviewInput, FulfillmentMethod, PaymentMethod } from '@/types/order';

type Step = 'fulfillment' | 'address' | 'payment' | 'review';

const DELIVERY_STEPS: Step[] = ['fulfillment', 'address', 'payment', 'review'];
const PICKUP_STEPS: Step[] = ['fulfillment', 'payment', 'review'];

const STEP_LABEL: Record<Step, string> = {
  fulfillment: 'Method',
  address: 'Address',
  payment: 'Payment',
  review: 'Review',
};

/**
 * CHECKOUT
 *
 * STATE (§54)
 * Everything on this screen is local `useState`: the chosen method, address,
 * payment method, note and the current step. None of it is shared with any
 * other screen, none of it survives navigation, and putting it in a global
 * store would only create a stale-state problem on the shopper's next visit.
 * The one genuinely global thing here — the session — already lives in Zustand.
 *
 * SERVER AUTHORITY (§1, §32)
 * No total is computed here. `useCheckoutPreview` asks the server, and the
 * server recalculates everything again when the order is placed. The four
 * pieces of state above are exactly what the API accepts; there is no price,
 * fee or total anywhere in this component's state or in its requests.
 *
 * ROUTING COST (§59)
 * The preview query is keyed on the *choices*, so it runs when the shopper
 * picks an address or switches method — not while they type. A half-typed
 * address cannot trigger a routing request because a half-typed address has no
 * id to send.
 */
export function CheckoutScreen() {
  const router = useRouter();
  const sessionStatus = useAuthStore((state) => state.status);

  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('DELIVERY');
  const [addressId, setAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>('CASH_ON_DELIVERY');
  const [customerNote, setCustomerNote] = useState('');
  const [step, setStep] = useState<Step>('fulfillment');
  const [validationError, setValidationError] = useState<string | null>(null);

  const idempotency = useIdempotencyKey();
  const { data: cart, isPending: isCartPending } = useCart();
  const acceptPrices = useAcceptPriceChanges();
  const placeOrder = usePlaceOrder();

  const steps = fulfillmentMethod === 'DELIVERY' ? DELIVERY_STEPS : PICKUP_STEPS;
  const stepIndex = Math.max(0, steps.indexOf(step));

  /**
   * The preview input. Memoised because it is the query key: a new object
   * every render would refetch — and re-charge for routing — on every keystroke
   * anywhere on the page.
   */
  const previewInput = useMemo<CheckoutPreviewInput | null>(() => {
    if (fulfillmentMethod === 'PICKUP') {
      return { fulfillmentMethod, paymentMethod: paymentMethod ?? undefined };
    }
    if (!addressId) return null;
    return { fulfillmentMethod, addressId, paymentMethod: paymentMethod ?? undefined };
  }, [fulfillmentMethod, addressId, paymentMethod]);

  const preview = useCheckoutPreview(previewInput);

  // --- Session and cart gates ---------------------------------------------

  if (sessionStatus === 'loading' || isCartPending) {
    return (
      <Container className="flex flex-col gap-gutter py-lg">
        <Skeleton className="h-8 w-40" label="Opening checkout" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </Container>
    );
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <Container className="py-lg">
        <h1 id="main-content" className="text-xl font-semibold text-text">
          Checkout
        </h1>
        <EmptyState
          icon={<UserRound className="size-7" aria-hidden="true" />}
          title="Sign in to place your order"
          description="Your cart is saved to your account and will be waiting for you."
          action={
            <ButtonLink href="/login?next=%2Fcheckout" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-lg rounded-lg bg-surface-muted"
        />
      </Container>
    );
  }

  if (!cart || cart.itemCount === 0) {
    return (
      <Container className="py-lg">
        <h1 id="main-content" className="text-xl font-semibold text-text">
          Checkout
        </h1>
        <EmptyState
          icon={<ShoppingCart className="size-7" aria-hidden="true" />}
          title="Your cart is empty"
          description="Add a few things to your cart, then come back to check out."
          action={
            <ButtonLink href="/categories" variant="primary">
              Start shopping
            </ButtonLink>
          }
          className="mt-lg rounded-lg bg-surface-muted"
        />
      </Container>
    );
  }

  // --- Navigation ----------------------------------------------------------

  const goNext = () => {
    setValidationError(null);

    if (step === 'fulfillment') {
      setStep(fulfillmentMethod === 'DELIVERY' ? 'address' : 'payment');
      return;
    }

    if (step === 'address') {
      if (!addressId) {
        setValidationError('Choose a delivery address to continue.');
        return;
      }
      setStep('payment');
      return;
    }

    if (step === 'payment') {
      if (!paymentMethod) {
        setValidationError('Choose how you would like to pay.');
        return;
      }
      setStep('review');
    }
  };

  const goBack = () => {
    setValidationError(null);
    const previous = steps[stepIndex - 1];
    if (previous) setStep(previous);
  };

  const changeFulfillment = (method: FulfillmentMethod) => {
    setFulfillmentMethod(method);
    // Switching to pickup abandons the address; switching back re-asks for one.
    if (method === 'PICKUP') setAddressId(null);
  };

  const submit = () => {
    if (!paymentMethod) return;

    placeOrder.mutate(
      {
        values: {
          fulfillmentMethod,
          addressId: fulfillmentMethod === 'DELIVERY' ? (addressId ?? undefined) : undefined,
          paymentMethod,
          customerNote: customerNote.trim() || undefined,
        },
        // The same key for every retry of this attempt, so a double-tap or a
        // dropped connection cannot produce a second order.
        idempotencyKey: idempotency.current(),
      },
      {
        onSuccess: (order) => router.push('/checkout/confirmation/' + order.id),
        onError: () => {
          // The shopper will have to change something — a line sold out, a
          // price moved — so the next attempt is genuinely a new one and must
          // not be answered with a replay of this failure.
          idempotency.reset();
        },
      },
    );
  };

  const isPlacing = placeOrder.isPending;
  const canPlaceOrder = Boolean(preview.data) && Boolean(paymentMethod) && !isPlacing;

  return (
    <Container className="flex flex-col gap-lg py-lg">
      <header className="flex flex-col gap-gutter">
        <div className="flex items-center gap-xs">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back to the previous step"
              className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-muted"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          ) : null}

          <h1 id="main-content" className="text-xl font-semibold text-text">
            Checkout
          </h1>
        </div>

        <CheckoutSteps steps={steps.map((value) => STEP_LABEL[value])} current={stepIndex} />
      </header>

      <div className="flex flex-col gap-lg lg:flex-row lg:items-start lg:gap-8">
        {/* --- Left: the current step ------------------------------------ */}
        <div className="flex flex-1 flex-col gap-lg">
          {step === 'fulfillment' ? (
            <FulfillmentSelector value={fulfillmentMethod} onChange={changeFulfillment} />
          ) : null}

          {step === 'address' ? (
            <section aria-labelledby="address-step-heading" className="flex flex-col gap-gutter">
              <h2 id="address-step-heading" className="text-base font-semibold text-text">
                Where should we deliver this order?
              </h2>

              <AddressPicker
                selectedId={addressId}
                onSelect={setAddressId}
                error={validationError ?? undefined}
              />
            </section>
          ) : null}

          {step === 'payment' ? (
            <>
              <PaymentSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
                fulfillmentMethod={fulfillmentMethod}
                error={validationError ?? undefined}
              />

              <Textarea
                label="Anything the store should know?"
                hint="Optional. For example: please pack the eggs separately."
                maxLength={500}
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
              />
            </>
          ) : null}

          {step === 'review' ? (
            <ReviewStep
              fulfillmentMethod={fulfillmentMethod}
              preview={preview.data ?? null}
              customerNote={customerNote}
              onEditAddress={() => setStep('address')}
              onEditPayment={() => setStep('payment')}
            />
          ) : null}

          {/* Preview failures appear on whichever step caused them. */}
          {preview.isError ? (
            <CheckoutProblem
              error={preview.error}
              onAcceptPrices={() => acceptPrices.mutate()}
              isAcceptingPrices={acceptPrices.isPending}
              onRetry={() => void preview.refetch()}
            />
          ) : null}

          {placeOrder.isError ? (
            <CheckoutProblem
              error={placeOrder.error}
              onAcceptPrices={() => acceptPrices.mutate()}
              isAcceptingPrices={acceptPrices.isPending}
              onRetry={() => placeOrder.reset()}
            />
          ) : null}
        </div>

        {/* --- Right: the running total ---------------------------------- */}
        <aside className="flex w-full flex-col gap-gutter lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
          {previewInput ? (
            <OrderSummaryPanel
              preview={preview.data ?? null}
              isLoading={preview.isFetching && !preview.data}
            />
          ) : (
            <div className="rounded-lg border border-outline-variant bg-surface-muted p-gutter text-sm text-text-muted">
              Choose a delivery address and we will work out your total, including the delivery
              charge, before you place the order.
            </div>
          )}

          {/*
            The desktop CTA. Its mobile counterpart is the sticky bar below.
            Both exist in the markup, but each is `display: none` at the other's
            breakpoint — so exactly one is in the accessibility tree at a time,
            and a screen reader never encounters two "Place order" buttons.
          */}
          <div className="hidden lg:block">
            {step === 'review' ? (
              <Button fullWidth size="lg" onClick={submit} disabled={!canPlaceOrder} isLoading={isPlacing}>
                Place order
                {preview.data ? ' · ' + formatPkr(preview.data.total) : ''}
              </Button>
            ) : (
              <Button fullWidth size="lg" onClick={goNext}>
                Continue
              </Button>
            )}
          </div>
        </aside>
      </div>

      {/*
        Mobile sticky action bar. The total travels with the button, so the
        shopper never has to scroll up to remember what they are agreeing to.
        `pb-[env(safe-area-inset-bottom)]` keeps it clear of the home indicator.
      */}
      <div className="sticky bottom-0 -mx-page mt-auto border-t border-outline-variant bg-surface px-page py-gutter pb-[max(var(--spacing-gutter),env(safe-area-inset-bottom))] shadow-raised lg:hidden">
        {step === 'review' ? (
          <div className="flex items-center gap-gutter">
            {preview.data ? (
              <div className="flex flex-col">
                <span className="text-xs text-text-muted">Total</span>
                <span className="text-lg font-bold tabular-nums text-primary">
                  {formatPkr(preview.data.total)}
                </span>
              </div>
            ) : null}

            <Button
              size="lg"
              onClick={submit}
              disabled={!canPlaceOrder}
              isLoading={isPlacing}
              className="flex-1"
            >
              Place order
            </Button>
          </div>
        ) : (
          <Button fullWidth size="lg" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </Container>
  );
}
