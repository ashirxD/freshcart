'use client';

import { useId } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ProductSort } from '@/types/catalog';

/**
 * The sort options, in plain language.
 *
 * There is no "Most popular": nothing records sales or views yet, so offering
 * it would sort by nothing and quietly mislead. It arrives with order history.
 */
const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: 'relevance', label: 'Best match' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest saving' },
  { value: 'newest', label: 'Newest first' },
  { value: 'name_asc', label: 'Name: A to Z' },
];

export interface SortSelectorProps {
  value: ProductSort | undefined;
  onChange: (sort: ProductSort) => void;
  className?: string;
}

/**
 * A native `<select>` on purpose: it gets the platform picker on a phone,
 * full keyboard support, and no bespoke listbox to get wrong.
 */
export function SortSelector({ value, onChange, className }: SortSelectorProps) {
  const id = useId();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="sr-only">
        Sort products by
      </label>

      <div
        className={cn(
          'min-h-touch border-outline-variant flex items-center gap-2 rounded-full border',
          'bg-surface ps-4 pe-2',
          'focus-within:border-primary focus-within:ring-primary/20 focus-within:ring-2',
        )}
      >
        <ArrowUpDown className="text-outline size-4 shrink-0" aria-hidden="true" />

        <select
          id={id}
          value={value ?? 'relevance'}
          onChange={(event) => onChange(event.target.value as ProductSort)}
          className="min-h-touch text-text bg-transparent pe-2 text-sm font-medium outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
