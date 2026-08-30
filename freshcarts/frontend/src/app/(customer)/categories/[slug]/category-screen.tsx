'use client';

import Link from 'next/link';
import { ChevronRight, PackageSearch } from 'lucide-react';
import { ProductBrowser } from '@/components/catalog/product-browser';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ProductGridSkeleton } from '@/components/product/product-grid';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategory } from '@/features/catalog/catalog.hooks';
import { ApiError } from '@/lib/api/errors';

/**
 * One dynamic screen for every category and subcategory.
 *
 * Whether the slug names a top-level category or a child is irrelevant here —
 * the API expands a parent to include its children, so the same page renders
 * "Dairy & Eggs" and "Milk" correctly without a special case.
 */
export function CategoryScreen({ slug }: { slug: string }) {
  const { data: category, isPending, isError, error, refetch } = useCategory(slug);

  if (isPending) {
    return (
      <Container className="gap-lg py-lg flex flex-col">
        <Skeleton className="h-8 w-56" label="Loading category" />
        <ProductGridSkeleton />
      </Container>
    );
  }

  if (isError) {
    const isMissing = error instanceof ApiError && error.status === 404;

    return (
      <Container className="py-lg">
        {isMissing ? (
          <EmptyState
            icon={<PackageSearch className="size-7" aria-hidden="true" />}
            title="Category not found"
            description="This category may have been renamed or is no longer available."
            action={
              // Never a dead end: the shopper always gets somewhere to go next.
              <ButtonLink href="/categories" variant="primary">
                Browse all categories
              </ButtonLink>
            }
            className="bg-surface-muted rounded-lg"
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </Container>
    );
  }

  return (
    <Container className="gap-lg py-lg flex flex-col">
      <header className="flex flex-col gap-2">
        <Breadcrumb category={category} />

        <h1 id="main-content" className="text-text text-xl font-semibold">
          {category.name}
        </h1>

        {category.description ? (
          <p className="text-text-muted max-w-prose text-sm">{category.description}</p>
        ) : null}
      </header>

      <ProductBrowser
        baseQuery={{ category: category.slug }}
        subcategories={category.children}
        emptyState={
          <EmptyState
            icon={<PackageSearch className="size-7" aria-hidden="true" />}
            title="Nothing matches those filters"
            description={'There are no products in ' + category.name + ' with those options.'}
            className="bg-surface-muted rounded-lg"
          />
        }
      />
    </Container>
  );
}

/** Root-first path built from the ancestors the API returns. */
function Breadcrumb({
  category,
}: {
  category: { name: string; ancestors: Array<{ id: string; name: string; slug: string }> };
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-text-muted flex flex-wrap items-center gap-1 text-sm">
        <li>
          <Link href="/categories" className="hover:text-primary">
            Categories
          </Link>
        </li>

        {category.ancestors.map((ancestor) => (
          <li key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            <Link href={'/categories/' + ancestor.slug} className="hover:text-primary">
              {ancestor.name}
            </Link>
          </li>
        ))}

        <li className="flex items-center gap-1">
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="text-text font-medium">
            {category.name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
