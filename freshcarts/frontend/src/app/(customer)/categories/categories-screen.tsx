'use client';

import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { CategoryGrid, CategoryGridSkeleton } from '@/components/category/category-card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { useCategories } from '@/features/catalog/catalog.hooks';

/**
 * Every category in the store, grouped by its top-level parent.
 *
 * One dynamic screen serves every category — there is no page per category and
 * no category name written into the frontend.
 */
export function CategoriesScreen() {
  const { data, isPending, isError, error, refetch } = useCategories({ withProductCount: true });

  return (
    <Container className="gap-lg py-lg flex flex-col">
      <header className="flex flex-col gap-1">
        <h1 id="main-content" className="text-text text-xl font-semibold">
          All categories
        </h1>
        <p className="text-text-muted text-sm">Browse the whole store, aisle by aisle.</p>
      </header>

      {isPending ? <CategoryGridSkeleton count={12} /> : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-7" aria-hidden="true" />}
          title="No categories yet"
          description="The store has not published any categories. Please check back soon."
          className="bg-surface-muted rounded-lg"
        />
      ) : null}

      {data?.map((category) => (
        <section key={category.id} className="gap-gutter flex flex-col">
          <div className="gap-gutter flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-text text-lg font-semibold">
                <Link href={'/categories/' + category.slug} className="hover:text-primary">
                  {category.name}
                </Link>
              </h2>
              {category.description ? (
                <p className="text-text-muted text-sm">{category.description}</p>
              ) : null}
            </div>

            <Link
              href={'/categories/' + category.slug}
              className="text-primary shrink-0 text-sm font-medium"
            >
              {category.productCount === 1 ? '1 item' : (category.productCount ?? 0) + ' items'}
            </Link>
          </div>

          {category.children.length > 0 ? (
            <CategoryGrid categories={category.children} />
          ) : (
            <p className="text-text-muted text-sm">
              No subcategories yet — open {category.name} to see its products.
            </p>
          )}
        </section>
      ))}
    </Container>
  );
}
