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
  className?: string;
}

/**
 * Deliberately uncontrolled: the input owns its own text and only reports a
 * debounced term outward. A controlled variant would push a re-render of the
 * whole results page on every keystroke for no benefit.
 *
 * Debouncing lives here so no screen fires a request per character typed.
 */
export function SearchBar({
  defaultValue = '',
  placeholder = 'Search for atta, doodh, sabzi...',
  label = 'Search products',
  onSearch,
  onSubmit,
  debounceMs = 300,
  autoFocus = false,
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

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn(
        'min-h-touch bg-surface-sunken px-gutter flex w-full items-center gap-2 rounded-full',
        'focus-within:ring-primary/25 focus-within:ring-2',
        className,
      )}
    >
      <Search className="text-outline size-5 shrink-0" aria-hidden="true" />

      <input
        type="search"
        value={term}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        onChange={(event) => setTerm(event.target.value)}
        className={cn(
          'text-text w-full bg-transparent py-3 text-base outline-none',
          'placeholder:text-outline',
          // The browser's own clear button would duplicate ours.
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />

      {term ? (
        <button
          type="button"
          onClick={() => setTerm('')}
          aria-label="Clear search"
          className="text-outline hover:bg-surface-muted -mr-1 shrink-0 rounded-full p-1"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}
