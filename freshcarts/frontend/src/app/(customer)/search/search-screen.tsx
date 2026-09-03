'use client';

import Link from 'next/link';
import { SearchX, Tag } from 'lucide-react';
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
 * Roman-Urdu examples, offered as one-tap searches.
 *
 * The same list as the storefront hero, and for the same reason (§60, §78):
 * these are the words the shoppers this is built for actually use, and the
 * catalogue indexes them as `searchTerms`, so each one returns real products.
 */
const SUGGESTIONS = ['atta', 'doodh', 'cheeni', 'sabzi', 'anday', 'chai', 'tel', 'namak'];

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
    <div className="flex flex-col">
      {/* The field is the whole point of this screen, so it gets the cream
          band to itself and is set at hero size rather than header size. */}
      <div className="bg-cream py-wide">
        <Container className="gap-gutter flex max-w-3xl flex-col">
          <h1 className="text-display text-primary">
            {term ? (
              <>
                Results for <span className="text-text">“{term}”</span>
              </>
            ) : (
              'What are you looking for?'
            )}
          </h1>

          <SearchBar
            variant="hero"
            defaultValue={term}
            autoFocus={!term}
            onSubmit={(value) => setFilters({ search: value.trim() || undefined })}
          />

          <div className="gap-tight flex flex-wrap items-center">
            <span className="text-text-muted text-xs font-semibold">Try:</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setFilters({ search: suggestion })}
                className="bg-surface/70 text-text ring-sand hover:bg-surface hover:ring-leaf/40 min-h-11 rounded-full px-3 text-xs font-semibold ring-1 transition-[background-color,box-shadow] sm:min-h-8 sm:px-2.5"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </Container>
      </div>

      <Container className="py-wide">
        {term ? (
          <ProductBrowser emptyState={<NoResults term={term} categories={categories} />} />
        ) : (
          <StartHere categories={categories} />
        )}
      </Container>
    </div>
  );
}

/**
 * A dead end is the worst outcome of a search, so this always offers a route
 * onward: adjust the search, or browse the aisles instead.
 */
function NoResults({ term, categories }: { term: string; categories: Category[] }) {
  return (
    <div className="gap-section flex flex-col">
      <EmptyState
        icon={<SearchX aria-hidden="true" />}
        title={'Nothing found for “' + term + '”'}
        description="Try a shorter word, check the spelling, or open one of the aisles below."
        className="bg-surface-muted rounded-2xl"
      />

      {categories.length > 0 ? (
        <section className="gap-loose flex flex-col">
          <SectionHeader
            eyebrow="Another way in"
            title="Browse the aisles instead"
            actionHref="/categories"
          />
          <CategoryRail categories={categories} />
        </section>
      ) : null}
    </div>
  );
}

/** Shown before a term is entered — an empty results grid would say nothing. */
function StartHere({ categories }: { categories: Category[] }) {
  return (
    <div className="gap-section flex flex-col">
      {categories.length > 0 ? (
        <section className="gap-loose flex flex-col">
          <SectionHeader
            eyebrow="Shop by aisle"
            title="Or browse instead of typing"
            subtitle="Search understands the name you use — “doodh”, “atta” and “sabzi” all work."
            actionHref="/categories"
          />
          <CategoryRail categories={categories} />
        </section>
      ) : null}

      <Link
        href="/search?sale=true&sort=discount"
        className="group ring-outline-variant bg-surface p-gutter gap-gutter shadow-card hover:shadow-raised flex items-center rounded-2xl ring-1 transition-shadow"
      >
        <span
          aria-hidden="true"
          className="bg-tomato/12 text-tomato flex size-12 shrink-0 items-center justify-center rounded-xl"
        >
          <Tag className="size-6" />
        </span>

        <span className="flex flex-col">
          <span className="text-text text-card">Looking for a deal?</span>
          <span className="text-text-muted text-sm">
            See everything the shop has reduced today.
          </span>
        </span>
      </Link>
    </div>
  );
}
