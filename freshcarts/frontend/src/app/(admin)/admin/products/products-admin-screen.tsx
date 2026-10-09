'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { StatusPill } from '@/components/admin/status-pill';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { Ltr, Money } from '@/components/common/ltr';
import { Container } from '@/components/layout/container';
import { AvailabilityBadge } from '@/components/product/badges';
import { ProductImage } from '@/components/product/product-image';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminProducts,
  useDeleteProduct,
  useSetProductStatus,
} from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import { formatPkr } from '@/lib/format';

/**
 * The product catalogue, including deactivated products.
 *
 * This reads the same `GET /products` the storefront uses — an admin token
 * simply unlocks `includeInactive`, so there is no parallel admin listing to
 * keep in sync.
 */
export function ProductsAdminScreen() {
  const { t, tx } = useI18n();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch } = useAdminProducts({
    search: search || undefined,
    page,
    limit: 20,
    sort: 'name_asc',
  });

  const setStatus = useSetProductStatus();
  const remove = useDeleteProduct();

  return (
    <Container className="gap-loose flex flex-col">
      <header className="gap-gutter flex flex-wrap items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-text text-xl font-semibold">{t('admin.products.title')}</h1>
          <p className="text-text-muted text-sm">
            {data
              ? t('admin.products.count', { count: data.pagination.total })
              : t('common.loading')}
          </p>
        </div>

        <ButtonLink
          href="/admin/products/new"
          leadingIcon={<Plus className="size-4" aria-hidden="true" />}
        >
          {t('admin.products.new')}
        </ButtonLink>
      </header>

      <SearchBar
        placeholder={t('admin.products.searchPlaceholder')}
        label={t('admin.products.searchLabel')}
        onSearch={(term) => {
          setSearch(term);
          // A new search means a new result set; staying on page 4 would show
          // an empty page.
          setPage(1);
        }}
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" label={t('admin.products.loadingRows')} />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.items.length === 0 ? (
        <p className="bg-surface-muted p-loose text-text-muted rounded-lg text-center text-sm">
          {search
            ? tx('admin.products.noMatch', { term: <bdi>{search}</bdi> })
            : t('admin.products.noneYet')}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.items.map((product) => (
            <li
              key={product.id}
              className="gap-gutter border-outline-variant bg-surface p-gutter flex flex-wrap items-center rounded-lg border"
            >
              <div className="bg-surface-muted relative size-14 shrink-0 overflow-hidden rounded-md">
                <ProductImage
                  image={product.primaryImage}
                  name={product.name}
                  sizes="56px"
                  className="size-full"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-text text-sm font-semibold">
                    <bdi>{product.name}</bdi>
                  </h2>
                  <StatusPill isActive={product.isActive} />
                  {product.isFeatured ? (
                    <span className="bg-secondary-container text-on-secondary-container rounded-full px-2 py-0.5 text-xs font-semibold">
                      {t('admin.products.featured')}
                    </span>
                  ) : null}
                </div>

                <p className="text-text-muted text-xs">
                  <Ltr>{product.sku}</Ltr> · {product.unitLabel}
                  {product.brand ? (
                    <>
                      {' · '}
                      <bdi>{product.brand}</bdi>
                    </>
                  ) : null}
                </p>

                <AvailabilityBadge stock={product.stock} />
              </div>

              <p className="text-text font-semibold tabular-nums">
                <Money>{formatPkr(product.sellingPrice)}</Money>
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <ButtonLink href={'/admin/products/' + product.id} variant="outline" size="sm">
                  {t('common.edit')}
                </ButtonLink>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatus.mutate({ id: product.id, isActive: !product.isActive })}
                >
                  {product.isActive ? t('admin.products.deactivate') : t('admin.products.activate')}
                </Button>

                <Button variant="ghost" size="sm" onClick={() => remove.mutate(product.id)}>
                  {t('admin.products.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <nav aria-label={t('admin.products.pagesLabel')} className="gap-gutter flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {t('common.previous')}
          </Button>

          <span aria-live="polite" className="text-text-muted text-sm">
            {t('common.page', { page: data.pagination.page, pages: data.pagination.totalPages })}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('common.next')}
          </Button>
        </nav>
      ) : null}
    </Container>
  );
}
