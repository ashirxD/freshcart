'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  /**
   * The accessible name of the field. Defaults to the storefront's product
   * search, but every other search — customers, orders, staff — must say what
   * it searches, or a screen reader announces four identical controls.
   */
  label?: string;
  /** Called with the debounced term as the shopper types. */
  onSearch?: (term: string) => void;
  /** Called when the shopper submits (Enter or the on-screen search key). */
  onSubmit?: (term: string) => void;
  debounceMs?: number;
  autoFocus?: boolean;
  /**
   * `hero` is the storefront's main search: a taller field with a visible
   * search button, because a shopper who is not sure what to do next needs
   * something obvious to press. `bar` is the compact version for the header
   * and for back-office lists.
   */
  variant?: 'bar' | 'hero';
  className?: string;
}

/**
 * Deliberately uncontrolled: the input owns its own text and only reports a
 * debounced term outward. A controlled variant would push a re-render of the
 * whole results page on every keystroke for no benefit.
 *
 * Debouncing lives here so no screen fires a request per character typed.
 *
 * THE FOCUS TREATMENT (§18)
 * On focus the field goes to white, gains a soft green ring and lifts on a
 * shadow — it comes forward rather than merely changing colour. That is the one
 * animation in this component: no expanding width, no moving placeholder, both
 * of which shift the layout under a thumb that is already on its way down.
 */
export function SearchBar({
  defaultValue = '',
  placeholder = 'Search atta, doodh, sabzi…',
  label = 'Search products',
  onSearch,
  onSubmit,
  debounceMs = 300,
  autoFocus = false,
  variant = 'bar',
  className,
}: SearchBarProps) {
  const [term, setTerm] = useState(defaultValue);

  // Held in a ref so an inline arrow prop does not restart the timer on every
  // parent render, which would make the debounce never fire under load.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't fire a search for the initial (usually empty) value.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => onSearchRef.current?.(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.(term);
  };

  const isHero = variant === 'hero';

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn(
        'group flex w-full items-center gap-2',
        'ease-standard border transition-[background-color,border-color,box-shadow] duration-200',
        'focus-within:border-primary/45 focus-within:bg-surface focus-within:shadow-raised',
        isHero
          ? 'ps-loose bg-surface border-outline-variant shadow-card min-h-14 rounded-2xl pe-2'
          : 'px-gutter bg-surface-sunken min-h-touch rounded-full border-transparent',
        className,
      )}
    >
      <Search
        className={cn(
          'text-outline shrink-0 transition-colors duration-200',
          'group-focus-within:text-primary',
          isHero ? 'size-5' : 'size-5',
        )}
        aria-hidden="true"
      />

      <input
        type="search"
        value={term}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        onChange={(event) => setTerm(event.target.value)}
        className={cn(
          'text-text w-full min-w-0 bg-transparent outline-none',
          'placeholder:text-outline',
          isHero ? 'py-3.5 text-base' : 'py-3 text-base',
          // The browser's own clear button would duplicate ours.
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />

      {term ? (
        <button
          type="button"
          onClick={() => setTerm('')}
          aria-label="Clear search"
          className="text-outline hover:bg-surface-muted hover:text-text -me-1 shrink-0 rounded-full p-1.5 transition-colors"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}

      {isHero ? (
        <button
          type="submit"
          className={cn(
            'bg-primary text-on-primary shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold',
            'ease-standard transition-[background-color,transform] duration-150',
            'hover:bg-primary-container active:translate-y-px',
            // On a narrow phone the label would crowd the field, so it becomes
            // an icon — with the label kept for screen readers.
            'flex min-h-11 items-center gap-1.5',
          )}
        >
          <Search className="size-4 sm:hidden" aria-hidden="true" />
          <span className="max-sm:sr-only">Search</span>
        </button>
      ) : null}
    </form>
  );
}
