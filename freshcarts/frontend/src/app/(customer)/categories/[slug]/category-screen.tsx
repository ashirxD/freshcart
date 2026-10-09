'use client';

import Link from 'next/link';
import { ChevronRight, PackageSearch } from 'lucide-react';
import { ProductBrowser } from '@/components/catalog/product-browser';
import { CategoryIcon } from '@/components/category/category-icon';
import { categoryTone } from '@/components/category/category-tone';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ProductGridSkeleton } from '@/components/product/product-grid';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategory } from '@/features/catalog/catalog.hooks';
import { useI18n, useT } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';

/**
 * One dynamic screen for every category and subcategory.
 *
 * Whether the slug names a top-level category or a child is irrelevant here —
 * the API expands a parent to include its children, so the same page renders
 * "Dairy & Eggs" and "Milk" correctly without a special case.
 *
 * The aisle's own tone washes the header band, which is what tells a shopper
 * they have arrived somewhere rather than at another white page (§57).
 */
export function CategoryScreen({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { data: category, isPending, isError, error, refetch } = useCategory(slug);

  if (isPending) {
    return (
      <div className="flex flex-col">
        <div className="bg-surface-muted py-wide">
          <Container className="gap-snug flex flex-col">
            <Skeleton className="h-4 w-48" label={t('categories.loading')} />
            <Skeleton className="h-9 w-64" />
          </Container>
        </div>
        <Container className="py-wide">
          <ProductGridSkeleton />
        </Container>
      </div>
    );
  }

  if (isError) {
    const isMissing = error instanceof ApiError && error.status === 404;

    return (
      <Container className="py-wide">
        {isMissing ? (
          <EmptyState
            icon={<PackageSearch aria-hidden="true" />}
            title={t('categories.missingTitle')}
            description={t('categories.missingBody')}
            action={
              // Never a dead end: the shopper always gets somewhere to go next.
              <ButtonLink href="/categories" variant="primary">
                {t('categories.browseAll')}
              </ButtonLink>
            }
            className="bg-surface-muted rounded-2xl"
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </Container>
    );
  }

  const tone = categoryTone(category.slug);

  return (
    <div className="flex flex-col">
      <div className={cn('py-wide', tone.surface)}>
        <Container className="flex flex-col gap-3">
          <Breadcrumb category={category} />

          <div className="gap-gutter flex items-center">
            <span
              aria-hidden="true"
              className={cn(
                'shadow-inset-tile flex size-14 shrink-0 items-center justify-center rounded-2xl',
                tone.disc,
                tone.ink,
              )}
            >
              <CategoryIcon name={category.icon} className="size-7" />
            </span>

            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-display text-text">{category.name}</h1>
              {category.description ? (
                <p className="text-text-muted max-w-prose text-sm">{category.description}</p>
              ) : null}
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-wide">
        <ProductBrowser
          baseQuery={{ category: category.slug }}
          subcategories={category.children}
          emptyState={
            <EmptyState
              icon={<PackageSearch aria-hidden="true" />}
              title={t('categories.noMatchTitle')}
              description={t('categories.noMatchBody', { name: category.name })}
              className="bg-surface-muted rounded-2xl"
            />
          }
        />
      </Container>
    </div>
  );
}

/** Root-first path built from the ancestors the API returns. */
function Breadcrumb({
  category,
}: {
  category: { name: string; ancestors: Array<{ id: string; name: string; slug: string }> };
}) {
  const t = useT();

  return (
    <nav aria-label={t('categories.breadcrumbLabel')}>
      <ol className="text-text-muted flex flex-wrap items-center gap-1 text-sm">
        <li>
          <Link href="/categories" className="hover:text-primary transition-colors">
            {t('categories.breadcrumbRoot')}
          </Link>
        </li>

        {category.ancestors.map((ancestor) => (
          <li key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            <Link
              href={'/categories/' + ancestor.slug}
              className="hover:text-primary transition-colors"
            >
              {ancestor.name}
            </Link>
          </li>
        ))}

        <li className="flex items-center gap-1">
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="text-text font-semibold">
            {category.name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
