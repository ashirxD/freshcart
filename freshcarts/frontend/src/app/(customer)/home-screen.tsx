'use client';

import { PackageOpen } from 'lucide-react';
import { CategoryGridSkeleton, CategoryRail } from '@/components/category/category-card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionHeader, type SectionAccent } from '@/components/common/section-header';
import { Hero } from '@/components/home/hero';
import { OfferBand } from '@/components/home/offer-band';
import { ScanFeature } from '@/components/home/scan-feature';
import { ServicePanel } from '@/components/home/service-panel';
import { Container } from '@/components/layout/container';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid';
import { ProductRail, ProductRailSkeleton } from '@/components/product/product-rail';
import { ProductSpotlight } from '@/components/product/product-spotlight';
import { useCategories, useProducts } from '@/features/catalog/catalog.hooks';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/use-reveal';
import type { ProductQuery } from '@/types/catalog';

/**
 * THE STOREFRONT
 *
 * Read top to bottom this is: welcome and search (cream) → the aisles (paper) →
 * what is reduced (deep leaf band) → today's savings (green wash) → what the
 * store has picked out (paper) → the list scanner (peach) → what is new (paper)
 * → how the service works (sand) → footer (deep leaf). Six background zones,
 * four different section shapes, and no two adjacent bands the same — which is
 * what gives the page rhythm instead of the run of identical white blocks it
 * had before (§56, §57).
 *
 * HONESTY (§28, §71)
 * Every section is backed by a real query, and one the API genuinely supports.
 * There is no "Popular near you" and no "Most ordered", because nothing in this
 * system records what sells; there is no "Buy again", because that needs an
 * order history query that does not exist. What there is instead: what is
 * discounted, what the store marked as featured, and what arrived most
 * recently — three facts the catalogue can actually answer. A section whose
 * query comes back empty renders nothing at all rather than an empty heading.
 */
export function HomeScreen() {
  const t = useT();
  const categories = useCategories({ withProductCount: true });
  const aisles = useReveal();

  return (
    <div className="flex flex-col">
      <Hero />

      {/* --- The aisles ------------------------------------------------- */}
      <section ref={aisles.ref} className={cn('py-wide md:py-section', aisles.className)}>
        <Container className="gap-loose flex flex-col">
          <SectionHeader
            eyebrow={t('home.aisles.eyebrow')}
            title={t('home.aisles.title')}
            subtitle={t('home.aisles.subtitle')}
            actionHref="/categories"
            actionLabel={t('home.aisles.action')}
          />

          {categories.isPending ? <CategoryGridSkeleton count={8} /> : null}

          {categories.isError ? (
            <ErrorState
              error={categories.error}
              onRetry={() => void categories.refetch()}
              title={t('home.aisles.errorTitle')}
            />
          ) : null}

          {categories.data?.length === 0 ? (
            <EmptyState
              icon={<PackageOpen aria-hidden="true" />}
              title={t('home.aisles.emptyTitle')}
              description={t('home.aisles.emptyBody')}
              className="bg-surface-muted rounded-2xl"
            />
          ) : null}

          {categories.data && categories.data.length > 0 ? (
            <CategoryRail categories={categories.data} />
          ) : null}
        </Container>
      </section>

      <OfferBand />

      {/* --- What is reduced, as a swipeable shelf ---------------------- */}
      <ProductSection
        eyebrow={t('home.reduced.eyebrow')}
        title={t('home.reduced.title')}
        subtitle={t('home.reduced.subtitle')}
        accent="offer"
        query={{ discounted: true, sort: 'discount', limit: 12 }}
        seeAllHref="/search?sale=true&sort=discount"
        layout="rail"
        tone="shelf"
      />

      {/* --- What the store picked out, as a spotlight ------------------ */}
      <ProductSection
        eyebrow={t('home.picked.eyebrow')}
        title={t('home.picked.title')}
        subtitle={t('home.picked.subtitle')}
        query={{ featured: true, limit: 5 }}
        seeAllHref="/search?sort=relevance"
        layout="spotlight"
      />

      <ScanFeature />

      {/* --- What is new, as a compact grid ---------------------------- */}
      <ProductSection
        eyebrow={t('home.arrivals.eyebrow')}
        title={t('home.arrivals.title')}
        subtitle={t('home.arrivals.subtitle')}
        accent="berry"
        query={{ sort: 'newest', limit: 10 }}
        seeAllHref="/search?sort=newest"
        layout="grid"
      />

      <ServicePanel />
    </div>
  );
}

/** The three shapes a storefront shelf can take (§29). */
type SectionLayout = 'rail' | 'spotlight' | 'grid';

const TONES = {
  base: '',
  shelf: 'bg-leaf/6',
} as const;

/**
 * One storefront section.
 *
 * Kept as a small component so each section owns its own query and loading
 * state, and a slow one never blocks the rest of the page. The layout is a prop
 * rather than a copy of the markup, so the sections vary visually without
 * varying in how they behave.
 */
function ProductSection({
  eyebrow,
  title,
  subtitle,
  accent = 'leaf',
  query,
  seeAllHref,
  layout = 'rail',
  tone = 'base',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent?: SectionAccent;
  query: ProductQuery;
  seeAllHref: string;
  layout?: SectionLayout;
  tone?: keyof typeof TONES;
}) {
  const { data, isPending, isError, error, refetch } = useProducts(query);
  const reveal = useReveal();

  // An empty "Today's savings" heading is worse than no heading at all.
  if (!isPending && !isError && (data?.items.length ?? 0) === 0) return null;

  const products = data?.items ?? [];

  return (
    <section
      ref={reveal.ref}
      className={cn('py-wide md:py-section', TONES[tone], reveal.className)}
    >
      <Container className="gap-loose flex flex-col">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          accent={accent}
          actionHref={seeAllHref}
        />

        {isPending ? (
          layout === 'grid' ? (
            <ProductGridSkeleton count={5} />
          ) : (
            <ProductRailSkeleton />
          )
        ) : null}

        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {products.length > 0 && layout === 'rail' ? (
          <ProductRail products={products} label={title} />
        ) : null}

        {products.length > 0 && layout === 'spotlight' ? (
          <ProductSpotlight products={products} />
        ) : null}

        {products.length > 0 && layout === 'grid' ? (
          <ProductGrid products={products} priorityCount={0} />
        ) : null}
      </Container>
    </section>
  );
}
