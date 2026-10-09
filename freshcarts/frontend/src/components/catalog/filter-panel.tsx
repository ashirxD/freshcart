'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT, type TFunction } from '@/i18n';
import { cn } from '@/lib/cn';
import type { CatalogFilters } from '@/features/catalog/use-catalog-filters';
import type { Category } from '@/types/catalog';

/**
 * Price bands rather than a slider.
 *
 * Two-handled sliders are hard to operate on a phone and harder still for
 * someone new to apps. Named bands are one tap, and read as plain money.
 */
const PRICE_BANDS: Array<{ min?: number; max?: number }> = [
  { max: 200 },
  { min: 200, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000 },
];

const AMOUNT = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });

/**
 * The band's name, built from its edges so the figures never drift from the
 * numbers the filter actually applies. Rupees stay "Rs." in both languages.
 */
function bandLabel(band: { min?: number; max?: number }, t: TFunction): string {
  if (band.min === undefined && band.max !== undefined) {
    return t('catalog.priceUnder', { max: AMOUNT.format(band.max) });
  }
  if (band.min !== undefined && band.max === undefined) {
    return t('catalog.priceOver', { min: AMOUNT.format(band.min) });
  }
  return t('catalog.priceBetween', {
    min: AMOUNT.format(band.min ?? 0),
    max: AMOUNT.format(band.max ?? 0),
  });
}

/**
 * How many brands to show before the list is collapsed.
 *
 * The brand list is every brand in the catalogue, and it grows with the shop.
 * At around twenty it was taller than the results beside it, which defeated
 * the sticky sidebar entirely — a shopper had to scroll past the filters to
 * reach the products, then back up to change one.
 */
const BRANDS_SHOWN = 8;

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
 *
 * The chips are pills, which is exactly what §9 reserves pills for: small
 * multi-state controls. Their touch target is the full 48px on a phone, where
 * they are the primary interaction in the filter sheet, and relaxes to 40px in
 * the desktop sidebar where there is a mouse and vertical space is scarcer.
 */
export function FilterPanel({
  filters,
  onChange,
  onClear,
  brands,
  subcategories = [],
  className,
}: FilterPanelProps) {
  const t = useT();

  return (
    <div className={cn('gap-loose flex flex-col', className)}>
      <FilterGroup label={t('catalog.showMe')}>
        <Chip
          label={t('catalog.availableNow')}
          tone="fresh"
          active={filters.inStock === true}
          onClick={() => onChange({ inStock: filters.inStock ? undefined : true })}
        />
        <Chip
          label={t('catalog.onSale')}
          tone="sale"
          active={filters.discounted === true}
          onClick={() => onChange({ discounted: filters.discounted ? undefined : true })}
        />
      </FilterGroup>

      {subcategories.length > 0 ? (
        <FilterGroup label={t('catalog.type')}>
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
        </FilterGroup>
      ) : null}

      <FilterGroup label={t('catalog.price')}>
        {PRICE_BANDS.map((band) => (
          <Chip
            key={band.min + '-' + band.max}
            label={bandLabel(band, t)}
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
      </FilterGroup>

      {brands.length > 0 ? (
        <BrandGroup brands={brands} filters={filters} onChange={onChange} />
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        leadingIcon={<RotateCcw className="size-4" aria-hidden="true" />}
        className="self-start"
      >
        {t('catalog.clearAll')}
      </Button>
    </div>
  );
}

/**
 * The brand filter, collapsed to the first few.
 *
 * The chosen brand is always shown even when it falls outside the visible
 * slice — otherwise selecting "Sunsilk", collapsing, and coming back leaves an
 * active filter with nothing on screen to turn it off.
 */
function BrandGroup({
  brands,
  filters,
  onChange,
}: {
  brands: string[];
  filters: CatalogFilters;
  onChange: (next: Partial<CatalogFilters>) => void;
}) {
  const t = useT();
  const [isExpanded, setExpanded] = useState(false);

  const visible = isExpanded ? brands : brands.slice(0, BRANDS_SHOWN);
  const shown =
    filters.brand && !visible.includes(filters.brand) ? [filters.brand, ...visible] : visible;
  const hiddenCount = brands.length - visible.length;

  return (
    <FilterGroup label={t('catalog.brand')}>
      {shown.map((brand) => (
        <Chip
          key={brand}
          label={brand}
          active={filters.brand === brand}
          onClick={() => onChange({ brand: filters.brand === brand ? undefined : brand })}
        />
      ))}

      {hiddenCount > 0 || isExpanded ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={isExpanded}
          className="text-primary hover:bg-primary/8 min-h-touch inline-flex items-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors lg:min-h-10"
        >
          {isExpanded ? t('catalog.showFewer') : t('catalog.more', { count: hiddenCount })}
          <ChevronDown
            className={cn(
              'ease-standard size-4 transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      ) : null}
    </FilterGroup>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="gap-snug flex flex-col">
      <legend className="mb-snug text-eyebrow text-text-muted uppercase">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** The accent an active chip takes, so "on sale" reads as a saving. */
const ACTIVE_TONES = {
  brand: 'border-primary bg-primary text-on-primary',
  fresh: 'border-leaf bg-leaf text-on-primary',
  sale: 'border-tomato bg-tomato text-on-tomato',
} as const;

/**
 * A toggle rendered as a button with `aria-pressed`, so its on/off state is
 * announced rather than left to colour.
 */
function Chip({
  label,
  active,
  onClick,
  tone = 'brand',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: keyof typeof ACTIVE_TONES;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-touch inline-flex items-center rounded-full border px-4 text-sm font-semibold lg:min-h-9 lg:px-3.5',
        'ease-standard transition-[background-color,border-color,color,transform] duration-150',
        'active:scale-[0.97]',
        active
          ? ACTIVE_TONES[tone]
          : 'border-outline-variant bg-surface text-text hover:border-primary/35 hover:bg-cream',
      )}
    >
      {label}
    </button>
  );
}
