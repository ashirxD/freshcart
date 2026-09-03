'use client';

import Link from 'next/link';
import { ArrowRight, PackageOpen } from 'lucide-react';
import {
  CategoryCard,
  CategoryGrid,
  CategoryGridSkeleton,
} from '@/components/category/category-card';
import { CategoryIcon } from '@/components/category/category-icon';
import { categoryTone } from '@/components/category/category-tone';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { cn } from '@/lib/cn';
import { useCategories } from '@/features/catalog/catalog.hooks';

/**
 * Every category in the store, grouped by its top-level parent.
 *
 * One dynamic screen serves every category — there is no page per category and
 * no category name written into the frontend.
 *
 * Each aisle gets a coloured header row carrying its own tone, so a long page
 * of subcategories reads as a series of aisles rather than one uninterrupted
 * list. The tone is the same one the tile uses on the storefront, which is what
 * makes "Dairy & Eggs" recognisable in both places.
 */
export function CategoriesScreen() {
  const { data, isPending, isError, error, refetch } = useCategories({ withProductCount: true });

  return (
    <div className="flex flex-col">
      <div className="bg-cream py-wide">
        <Container className="flex flex-col gap-2">
          <p className="text-eyebrow text-leaf uppercase">The whole shop</p>
          <h1 className="text-display text-primary">Every aisle, end to end</h1>
          <p className="text-text-muted max-w-xl text-sm">
            Browse by aisle, or open one to filter by type, price and brand.
          </p>
        </Container>
      </div>

      <Container className="gap-section py-wide flex flex-col">
        {isPending ? <CategoryGridSkeleton count={8} /> : null}

        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {data?.length === 0 ? (
          <EmptyState
            icon={<PackageOpen aria-hidden="true" />}
            title="No aisles yet"
            description="The shop has not published any categories. Please check back soon."
            className="bg-surface-muted rounded-2xl"
          />
        ) : null}

        {data?.map((category) => {
          const tone = categoryTone(category.slug);

          return (
            <section key={category.id} className="gap-gutter flex flex-col">
              <div
                className={cn(
                  'gap-gutter p-gutter flex flex-wrap items-center justify-between rounded-2xl',
                  tone.surface,
                )}
              >
                <div className="gap-snug flex min-w-0 items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'shadow-inset-tile flex size-12 shrink-0 items-center justify-center rounded-xl',
                      tone.disc,
                      tone.ink,
                    )}
                  >
                    <CategoryIcon name={category.icon} />
                  </span>

                  <div className="flex min-w-0 flex-col">
                    <h2 className="text-text text-lg font-bold tracking-[-0.02em]">
                      <Link href={'/categories/' + category.slug} className="hover:text-primary">
                        {category.name}
                      </Link>
                    </h2>
                    {category.description ? (
                      <p className="text-text-muted truncate text-sm">{category.description}</p>
                    ) : null}
                  </div>
                </div>

                <Link
                  href={'/categories/' + category.slug}
                  className="group text-primary bg-surface/70 hover:bg-surface flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors"
                >
                  {category.productCount === 1
                    ? 'Shop 1 item'
                    : 'Shop ' + (category.productCount ?? 0) + ' items'}
                  <ArrowRight
                    className="ease-standard size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </div>

              {category.children.length > 0 ? (
                <CategoryGrid categories={category.children} />
              ) : (
                // A parent with no subcategories is not an error — it just goes
                // straight to its products, so offer that instead of a dead row.
                <CategoryCard category={category} className="sm:max-w-xs" />
              )}
            </section>
          );
        })}
      </Container>
    </div>
  );
}
