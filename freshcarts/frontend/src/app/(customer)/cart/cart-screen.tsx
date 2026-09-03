'use client';

import { UserRound } from 'lucide-react';
import { CartItemRow } from '@/components/cart/cart-item-row';
import { CartSummary } from '@/components/cart/cart-summary';
import { EmptyBasketIllustration, EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ScanCta } from '@/components/scan/scan-cta';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart, useClearCart } from '@/features/cart/cart.hooks';
import { useAuthStore } from '@/store/auth.store';

/**
 * THE BASKET
 *
 * Shaped like a basket rather than a table: the lines sit together inside one
 * card with hairlines between them, and the money sits beside them in its own
 * panel that follows the page down on a desktop.
 */
export function CartScreen() {
  const status = useAuthStore((state) => state.status);
  const { data: cart, isPending, isError, error, refetch } = useCart();
  const clearCart = useClearCart();

  if (status === 'loading') {
    return (
      <Container className="gap-gutter py-wide flex flex-col">
        <Skeleton className="h-9 w-48" label="Loading your basket" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </Container>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Container className="py-wide">
        <h1 className="text-display text-primary">Your basket</h1>

        <EmptyState
          icon={<UserRound aria-hidden="true" />}
          title="Sign in to see your basket"
          description="Your basket is saved to your account, so it is waiting for you on any device."
          action={
            <ButtonLink href="/login?next=%2Fcart" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-loose bg-surface-muted rounded-2xl"
        />
      </Container>
    );
  }

  const isEmpty = cart?.itemCount === 0;

  return (
    <div className="flex flex-col">
      <div className="bg-cream py-loose">
        <Container className="gap-gutter flex flex-wrap items-end justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow text-leaf uppercase">
              {cart && cart.itemCount > 0
                ? cart.totalQuantity === 1
                  ? '1 item'
                  : cart.totalQuantity + ' items'
                : 'Nothing in it yet'}
            </p>
            <h1 className="text-display text-primary">Your basket</h1>
          </div>

          {cart && cart.itemCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              isLoading={clearCart.isPending}
              onClick={() => clearCart.mutate(undefined)}
            >
              Empty the basket
            </Button>
          ) : null}
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col">
        {isPending ? (
          <div className="gap-gutter flex flex-col">
            <Skeleton className="h-28 w-full rounded-2xl" label="Loading your basket" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : null}

        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {isEmpty ? (
          <EmptyState
            illustration={<EmptyBasketIllustration />}
            title="Your basket is waiting"
            description="Add a few everyday essentials and we will take it from there."
            action={
              <div className="gap-tight flex flex-col items-center">
                <ButtonLink href="/categories" variant="primary" size="lg">
                  Start shopping
                </ButtonLink>

                {/* An empty basket is exactly when a written list is in a pocket. */}
                <ScanCta variant="inline" />
              </div>
            }
            className="bg-surface-muted rounded-2xl"
          />
        ) : null}

        {cart && cart.itemCount > 0 ? (
          <div className="gap-loose flex flex-col lg:flex-row lg:items-start lg:gap-8">
            <ul className="divide-outline-variant ring-outline-variant bg-surface shadow-card flex flex-1 list-none flex-col divide-y overflow-hidden rounded-2xl ring-1">
              {cart.items.map((item) => (
                <CartItemRow key={item.productId} item={item} />
              ))}
            </ul>

            {/* Sticky on desktop so the total stays in view while scrolling a
                long basket; a normal block on mobile, where the sticky basket
                bar already carries the running total. */}
            <CartSummary cart={cart} className="lg:sticky lg:top-24 lg:w-80 lg:shrink-0" />
          </div>
        ) : null}
      </Container>
    </div>
  );
}
