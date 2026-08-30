'use client';

import { useRouter } from 'next/navigation';
import { MapPin, PackageOpen } from 'lucide-react';
import { CategoryGridSkeleton, CategoryRail } from '@/components/category/category-card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { SectionHeader } from '@/components/common/section-header';
import { Container } from '@/components/layout/container';
import { ProductRail } from '@/components/product/product-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories, useCurrentStore, useProducts } from '@/features/catalog/catalog.hooks';
import { useAuthStore } from '@/store/auth.store';
import type { ProductQuery } from '@/types/catalog';

/**
 * The storefront home screen.
 *
 * Every section is backed by a real query. Sections the data cannot honestly
 * support are absent rather than faked: there is no "Popular near you" until
 * something records what sells, and no "Buy again" until orders exist.
 */
export function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const store = useCurrentStore();
  const categories = useCategories({ withProductCount: true });

  const greeting = user ? 'Assalam-o-Alaikum, ' + user.fullName.split(' ')[0] : 'Assalam-o-Alaikum';

  return (
    <div id="main-content" className="gap-lg py-gutter flex flex-col">
      <Container className="gap-gutter flex flex-col">
        <header className="flex flex-col gap-1">
          {/* The line height is reserved while the session resolves, so the
              greeting does not push the page down when it arrives. */}
          <h1 className="text-primary text-2xl font-bold">
            {status === 'loading' ? ' ' : greeting}
          </h1>

          {store.data ? (
            <p className="text-text-muted flex items-center gap-1.5 text-sm">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Delivering from <span className="text-text font-medium">{store.data.name}</span>,{' '}
                {store.data.address.area}
              </span>
            </p>
          ) : (
            <Skeleton className="h-5 w-56" label="Loading store details" />
          )}
        </header>

        <SearchBar onSubmit={(term) => router.push('/search?q=' + encodeURIComponent(term))} />
      </Container>

      <Container className="gap-gutter flex flex-col">
        <SectionHeader
          title="Shop by category"
          subtitle="Fresh produce, pantry staples and daily essentials"
          actionHref="/categories"
        />

        {categories.isPending ? <CategoryGridSkeleton count={6} /> : null}

        {categories.isError ? (
          <ErrorState
            error={categories.error}
            onRetry={() => void categories.refetch()}
            title="We could not load the categories"
          />
        ) : null}

        {categories.data?.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="size-7" aria-hidden="true" />}
            title="The catalogue is being set up"
            description="Categories will appear here as soon as the store adds them."
            className="bg-surface-muted rounded-lg"
          />
        ) : null}

        {categories.data && categories.data.length > 0 ? (
          <CategoryRail categories={categories.data} />
        ) : null}
      </Container>

      <ProductSection
        title="Today's deals"
        subtitle="Discounted right now"
        query={{ discounted: true, sort: 'discount', limit: 10 }}
        seeAllHref="/search?sale=true&sort=discount"
      />

      <ProductSection
        title="Featured"
        subtitle="Picked by the store"
        query={{ featured: true, limit: 10 }}
        seeAllHref="/search?sort=relevance"
      />

      <ProductSection
        title="New in store"
        subtitle="Recently added to the catalogue"
        query={{ sort: 'newest', limit: 10 }}
        seeAllHref="/search?sort=newest"
      />
    </div>
  );
}

/**
 * One home-page rail. Kept as a small component so each section owns its own
 * query and loading state, and a slow one never blocks the rest of the page.
 *
 * A section with no results renders nothing at all — an empty "Today's deals"
 * heading is worse than no heading.
 */
function ProductSection({
  title,
  subtitle,
  query,
  seeAllHref,
}: {
  title: string;
  subtitle: string;
  query: ProductQuery;
  seeAllHref: string;
}) {
  const { data, isPending, isError, error, refetch } = useProducts(query);

  if (!isPending && !isError && (data?.items.length ?? 0) === 0) return null;

  return (
    <Container className="gap-gutter flex flex-col">
      <SectionHeader title={title} subtitle={subtitle} actionHref={seeAllHref} />

      {isPending ? (
        <div className="gap-gutter flex overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-64 w-40 shrink-0 sm:w-48"
              label={'Loading ' + title}
            />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data && data.items.length > 0 ? <ProductRail products={data.items} /> : null}
    </Container>
  );
}
