'use client';

import { useState } from 'react';
import { Heart, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/features/favorites/favorites.hooks';
import { useAuthStore } from '@/store/auth.store';

export function FavoritesScreen() {
  const [page, setPage] = useState(1);
  const status = useAuthStore((state) => state.status);
  const { data, isPending, isError, error, refetch } = useFavorites(page);

  if (status !== 'authenticated' && status !== 'loading') {
    return (
      <Container className="py-lg">
        <h1 id="main-content" className="text-text text-xl font-semibold">
          Saved items
        </h1>

        <EmptyState
          icon={<UserRound className="size-7" aria-hidden="true" />}
          title="Sign in to see your saved items"
          description="Tap the heart on any product to keep it here for next time."
          action={
            <ButtonLink href="/login?next=%2Ffavorites" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-lg bg-surface-muted rounded-lg"
        />
      </Container>
    );
  }

  // A favourited product that has since been deleted comes back with a null
  // product; there is nothing to render for it, so it is filtered out here.
  const products = (data?.items ?? [])
    .map((favorite) => favorite.product)
    .filter((product) => product !== null);

  const pagination = data?.pagination;

  return (
    <Container className="gap-lg py-lg flex flex-col">
      <header className="flex flex-col gap-1">
        <h1 id="main-content" className="text-text text-xl font-semibold">
          Saved items
        </h1>
        <p className="text-text-muted text-sm">
          Everything you have kept for later, ready to add to your cart.
        </p>
      </header>

      {isPending ? <ProductGridSkeleton count={4} /> : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {!isPending && !isError && products.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-7" aria-hidden="true" />}
          title="Nothing saved yet"
          description="Tap the heart on any product and it will wait for you here."
          action={
            <ButtonLink href="/categories" variant="primary">
              Browse the store
            </ButtonLink>
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : null}

      {products.length > 0 ? <ProductGrid products={products} /> : null}

      {pagination && pagination.totalPages > 1 ? (
        <nav aria-label="Saved items pages" className="gap-gutter flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>

          <span aria-live="polite" className="text-text-muted text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </Container>
  );
}
