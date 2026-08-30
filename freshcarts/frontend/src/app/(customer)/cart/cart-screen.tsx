'use client';

import { ShoppingCart, UserRound } from 'lucide-react';
import { CartItemRow } from '@/components/cart/cart-item-row';
import { CartSummary } from '@/components/cart/cart-summary';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart, useClearCart } from '@/features/cart/cart.hooks';
import { useAuthStore } from '@/store/auth.store';

export function CartScreen() {
  const status = useAuthStore((state) => state.status);
  const { data: cart, isPending, isError, error, refetch } = useCart();
  const clearCart = useClearCart();

  if (status === 'loading') {
    return (
      <Container className="gap-gutter py-lg flex flex-col">
        <Skeleton className="h-8 w-40" label="Loading your cart" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Container>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Container className="py-lg">
        <h1 id="main-content" className="text-text text-xl font-semibold">
          Your cart
        </h1>

        <EmptyState
          icon={<UserRound className="size-7" aria-hidden="true" />}
          title="Sign in to see your cart"
          description="Your cart is saved to your account, so it is waiting for you on any device."
          action={
            <ButtonLink href="/login?next=%2Fcart" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-lg bg-surface-muted rounded-lg"
        />
      </Container>
    );
  }

  return (
    <Container className="gap-lg py-lg flex flex-col">
      <header className="gap-gutter flex items-center justify-between">
        <h1 id="main-content" className="text-text text-xl font-semibold">
          Your cart
        </h1>

        {cart && cart.itemCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            isLoading={clearCart.isPending}
            onClick={() => clearCart.mutate(undefined)}
          >
            Empty cart
          </Button>
        ) : null}
      </header>

      {isPending ? (
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-24 w-full" label="Loading your cart" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {cart && cart.itemCount === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="size-7" aria-hidden="true" />}
          title="Your cart is empty"
          description="Add a few essentials and they will show up here."
          action={
            <ButtonLink href="/categories" variant="primary">
              Start shopping
            </ButtonLink>
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : null}

      {cart && cart.itemCount > 0 ? (
        <div className="gap-lg flex flex-col lg:flex-row lg:items-start lg:gap-8">
          <ul className="divide-outline-variant flex flex-1 list-none flex-col divide-y">
            {cart.items.map((item) => (
              <CartItemRow key={item.productId} item={item} />
            ))}
          </ul>

          {/* Sticky on desktop so the total stays in view while scrolling a
              long basket; a normal block on mobile, above the tab bar. */}
          <CartSummary cart={cart} className="lg:sticky lg:top-24 lg:w-80 lg:shrink-0" />
        </div>
      ) : null}
    </Container>
  );
}
