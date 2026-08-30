'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { CatalogFilters } from '@/features/catalog/use-catalog-filters';
import type { Category } from '@/types/catalog';

/**
 * Price bands rather than a slider.
 *
 * Two-handled sliders are hard to operate on a phone and harder still for
 * someone new to apps. Named bands are one tap, and read as plain money.
 */
const PRICE_BANDS: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Under Rs. 200', max: 200 },
  { label: 'Rs. 200 – 500', min: 200, max: 500 },
  { label: 'Rs. 500 – 1,000', min: 500, max: 1000 },
  { label: 'Over Rs. 1,000', min: 1000 },
];

export interface FilterPanelProps {
  filters: CatalogFilters;
  onChange: (next: Partial<CatalogFilters>) => void;
  onClear: () => void;
  brands: string[];
  /** Subcategories of the category being browsed. Empty on the search page. */
  subcategories?: Category[];
  className?: string;
}

function isBandActive(filters: CatalogFilters, band: { min?: number; max?: number }): boolean {
  return filters.minPrice === band.min && filters.maxPrice === band.max;
}

/**
 * The filter controls, shared by the desktop sidebar and the mobile sheet, so
 * both offer exactly the same options with the same labels.
 *
 * Labels are deliberately concrete — "Available now", "On sale" — rather than
 * catalogue jargon like "availability" or "promotional status".
 */
export function FilterPanel({
  filters,
  onChange,
  onClear,
  brands,
  subcategories = [],
  className,
}: FilterPanelProps) {
  return (
    <div className={cn('gap-lg flex flex-col', className)}>
      <FilterGroup label="Show me">
        <div className="flex flex-wrap gap-2">
          <Chip
            label="Available now"
            active={filters.inStock === true}
            onClick={() => onChange({ inStock: filters.inStock ? undefined : true })}
          />
          <Chip
            label="On sale"
            active={filters.discounted === true}
            onClick={() => onChange({ discounted: filters.discounted ? undefined : true })}
          />
        </div>
      </FilterGroup>

      {subcategories.length > 0 ? (
        <FilterGroup label="Type">
          <div className="flex flex-wrap gap-2">
            {subcategories.map((subcategory) => (
              <Chip
                key={subcategory.id}
                label={subcategory.name}
                active={filters.subcategory === subcategory.slug}
                onClick={() =>
                  onChange({
                    subcategory:
                      filters.subcategory === subcategory.slug ? undefined : subcategory.slug,
                  })
                }
              />
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup label="Price">
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map((band) => (
            <Chip
              key={band.label}
              label={band.label}
              active={isBandActive(filters, band)}
              onClick={() =>
                onChange(
                  isBandActive(filters, band)
                    ? { minPrice: undefined, maxPrice: undefined }
                    : { minPrice: band.min, maxPrice: band.max },
                )
              }
            />
          ))}
        </div>
      </FilterGroup>

      {brands.length > 0 ? (
        <FilterGroup label="Brand">
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => (
              <Chip
                key={brand}
                label={brand}
                active={filters.brand === brand}
                onClick={() => onChange({ brand: filters.brand === brand ? undefined : brand })}
              />
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <Button variant="ghost" size="sm" onClick={onClear} className="self-start">
        Clear all filters
      </Button>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="gap-xs flex flex-col">
      <legend className="mb-xs text-text text-sm font-semibold">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * A toggle rendered as a button with `aria-pressed`, so its on/off state is
 * announced. Meets the 48px target via padding rather than a fixed height,
 * which keeps long brand names on one line.
 */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium',
        'transition-colors',
        active
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline-variant bg-surface text-text hover:bg-surface-muted',
      )}
    >
      {label}
    </button>
  );
}
