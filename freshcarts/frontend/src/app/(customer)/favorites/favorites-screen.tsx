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
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/auth.store';

export function FavoritesScreen() {
  const t = useT();
  const [page, setPage] = useState(1);
  const status = useAuthStore((state) => state.status);
  const { data, isPending, isError, error, refetch } = useFavorites(page);

  if (status !== 'authenticated' && status !== 'loading') {
    return (
      <Container className="py-wide">
        <h1 className="text-display text-primary">{t('favorites.title')}</h1>

        <EmptyState
          icon={<UserRound aria-hidden="true" />}
          title={t('favorites.signInTitle')}
          description={t('favorites.signInBody')}
          action={
            <ButtonLink href="/login?next=%2Ffavorites" variant="primary">
              {t('nav.signIn')}
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
          <p className="text-eyebrow text-leaf uppercase">{t('favorites.eyebrow')}</p>
          <h1 className="text-display text-primary">{t('favorites.title')}</h1>
          <p className="text-text-muted text-sm">{t('favorites.subtitle')}</p>
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col">
        {isPending ? <ProductGridSkeleton count={4} /> : null}

        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {!isPending && !isError && products.length === 0 ? (
          <EmptyState
            icon={<Heart aria-hidden="true" />}
            title={t('favorites.emptyTitle')}
            description={t('favorites.emptyBody')}
            action={
              <ButtonLink href="/categories" variant="primary" size="lg">
                {t('common.browseAisles')}
              </ButtonLink>
            }
            className="bg-surface-muted rounded-2xl"
          />
        ) : null}

        {products.length > 0 ? <ProductGrid products={products} /> : null}

        {pagination && pagination.totalPages > 1 ? (
          <nav
            aria-label={t('favorites.pagesLabel')}
            className="gap-gutter flex items-center justify-center"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('common.previous')}
            </Button>

            <span aria-live="polite" className="text-text-muted text-sm">
              {t('common.page', { page: pagination.page, pages: pagination.totalPages })}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('common.next')}
            </Button>
          </nav>
        ) : null}
      </Container>
    </div>
  );
}
