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
      <Container className="py-wide">
        <h1 className="text-display text-primary">Saved items</h1>

        <EmptyState
          icon={<UserRound aria-hidden="true" />}
          title="Sign in to see your saved items"
          description="Tap the heart on any product to keep it here for next time."
          action={
            <ButtonLink href="/login?next=%2Ffavorites" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-loose bg-surface-muted rounded-2xl"
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
    <div className="flex flex-col">
      <div className="bg-cream py-loose">
        <Container className="flex flex-col gap-1">
          <p className="text-eyebrow text-leaf uppercase">Kept for later</p>
          <h1 className="text-display text-primary">Saved items</h1>
          <p className="text-text-muted text-sm">
            Everything you tapped the heart on, ready to add to your basket.
          </p>
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col">
        {isPending ? <ProductGridSkeleton count={4} /> : null}

        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {!isPending && !isError && products.length === 0 ? (
          <EmptyState
            icon={<Heart aria-hidden="true" />}
            title="Nothing saved yet"
            description="Tap the heart on any product and it will wait for you here."
            action={
              <ButtonLink href="/categories" variant="primary" size="lg">
                Browse the aisles
              </ButtonLink>
            }
            className="bg-surface-muted rounded-2xl"
          />
        ) : null}

        {products.length > 0 ? <ProductGrid products={products} /> : null}

        {pagination && pagination.totalPages > 1 ? (
          <nav
            aria-label="Saved items pages"
            className="gap-gutter flex items-center justify-center"
          >
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
    </div>
  );
}
