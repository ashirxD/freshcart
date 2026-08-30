'use client';

import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { ProductBrowser } from '@/components/catalog/product-browser';
import { CategoryRail } from '@/components/category/category-card';
import { EmptyState } from '@/components/common/empty-state';
import { SearchBar } from '@/components/common/search-bar';
import { SectionHeader } from '@/components/common/section-header';
import { Container } from '@/components/layout/container';
import { useCategories } from '@/features/catalog/catalog.hooks';
import { useCatalogFilters } from '@/features/catalog/use-catalog-filters';
import type { Category } from '@/types/catalog';

/**
 * Search across the catalogue.
 *
 * The term lives in the URL, so a search is shareable and survives a refresh,
 * and it is submitted rather than typed straight through — a request per
 * keystroke is wasteful on the connections this app is built for. The search
 * bar debounces the term it reports, and this screen commits it on submit.
 */
export function SearchScreen() {
  const { filters, setFilters } = useCatalogFilters();
  const { data: categories = [] } = useCategories();

  const term = filters.search?.trim() ?? '';

  return (
    <Container className="gap-lg py-lg flex flex-col">
      <header className="gap-gutter flex flex-col">
        <h1 id="main-content" className="text-text text-xl font-semibold">
          {term ? 'Results for “' + term + '”' : 'Search'}
        </h1>

        <SearchBar
          defaultValue={term}
          autoFocus={!term}
          onSubmit={(value) => setFilters({ search: value.trim() || undefined })}
        />
      </header>

      {term ? (
        <ProductBrowser emptyState={<NoResults term={term} categories={categories} />} />
      ) : (
        <StartHere categories={categories} />
      )}
    </Container>
  );
}

/**
 * A dead end is the worst outcome of a search, so this always offers a route
 * onward: adjust the search, or browse the aisles instead.
 */
function NoResults({ term, categories }: { term: string; categories: Category[] }) {
  return (
    <div className="gap-lg flex flex-col">
      <EmptyState
        icon={<SearchX className="size-7" aria-hidden="true" />}
        title={'No products found for “' + term + '”'}
        description="Try a shorter word, check the spelling, or browse the categories below."
        className="bg-surface-muted rounded-lg"
      />

      {categories.length > 0 ? (
        <section className="gap-gutter flex flex-col">
          <SectionHeader title="Browse categories instead" actionHref="/categories" />
          <CategoryRail categories={categories} />
        </section>
      ) : null}
    </div>
  );
}

/** Shown before a term is entered — an empty results grid would say nothing. */
function StartHere({ categories }: { categories: Category[] }) {
  return (
    <div className="gap-lg flex flex-col">
      <p className="text-text-muted text-sm">
        Search by product, brand or the name you use — “doodh”, “atta” and “sabzi” all work.
      </p>

      {categories.length > 0 ? (
        <section className="gap-gutter flex flex-col">
          <SectionHeader title="Or browse by category" actionHref="/categories" />
          <CategoryRail categories={categories} />
        </section>
      ) : null}

      <p className="text-text-muted text-sm">
        Looking for a deal?{' '}
        <Link href="/search?sale=true&sort=discount" className="text-primary font-medium">
          See what is on sale
        </Link>
        .
      </p>
    </div>
  );
}
