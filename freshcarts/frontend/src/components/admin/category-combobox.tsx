'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CategoryOption {
  id: string;
  name: string;
}

/**
 * What the form holds for a category field.
 *
 * Either an existing category (`id` set) or one the admin has asked to create
 * (`createName` set). Never both. Modelling it this way means the form knows,
 * without guessing, whether saving will need to create a category first — and
 * the "we are about to create something" state is visible to the person rather
 * than implied.
 */
export type CategorySelection =
  { id: string; createName?: undefined } | { id?: undefined; createName: string };

/** Case- and space-insensitive, so "  bakery " matches "Bakery". */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * A category picker that can also create.
 *
 * WHY A COMBO BOX AND NOT FREE TEXT: a plain text field silently turns every
 * typo into a new category. "Bakry" beside "Bakery" is not a small problem —
 * both appear to shoppers, products scatter across them, and nothing surfaces
 * the mistake. So an unmatched name is never created implicitly: the admin has
 * to pick the explicit "Create" row, which also puts the exact spelling in
 * front of them one more time before it becomes real.
 *
 * Existing options are matched case-insensitively, so typing "bakery" when
 * "Bakery" exists offers the existing one and does not offer to create a
 * duplicate.
 */
export function CategoryCombobox({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  allowCreate = true,
  emptyHint,
}: {
  label: string;
  hint?: string;
  error?: string;
  options: CategoryOption[];
  value: CategorySelection;
  onChange: (value: CategorySelection) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  /** Shown when there are no options at all, e.g. before a parent is chosen. */
  emptyHint?: string;
}) {
  const id = useId();
  const listId = id + '-list';
  const messageId = id + '-message';

  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = value.id ? options.find((option) => option.id === value.id) : undefined;

  // What the input shows: the typed query while open, otherwise the settled
  // choice — an existing name, or the name that is pending creation.
  const display = isOpen ? query : (selected?.name ?? value.createName ?? '');

  const matches = useMemo(() => {
    const needle = normalise(query);
    if (!needle) return options;
    return options.filter((option) => normalise(option.name).includes(needle));
  }, [options, query]);

  const exactMatch = useMemo(
    () => options.find((option) => normalise(option.name) === normalise(query)),
    [options, query],
  );

  const canCreate = allowCreate && query.trim().length >= 2 && !exactMatch;

  const choose = (next: CategorySelection) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="gap-tight flex w-full flex-col">
      <label htmlFor={id} className="text-text text-sm font-medium">
        {label}
      </label>

      <div className="relative">
        <div className="relative">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? messageId : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            value={display}
            onFocus={() => {
              setQuery('');
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onBlur={() => {
              // Deferred so a click on an option lands before the list closes.
              blurTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'Enter') {
                event.preventDefault();
                if (matches.length === 1) choose({ id: matches[0].id });
                else if (canCreate) choose({ createName: query.trim() });
              }
            }}
            className={cn(
              'bg-surface text-text px-gutter min-h-touch w-full rounded-md border py-3 text-base outline-none',
              'focus:border-primary focus:ring-primary/20 focus:ring-2',
              'disabled:opacity-50',
              error ? 'border-danger' : 'border-outline-variant',
            )}
          />

          <ChevronDown
            className="text-outline pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2"
            aria-hidden="true"
          />
        </div>

        {isOpen ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="border-outline-variant bg-surface shadow-card absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border"
            // Keeps the input's blur from firing before a click registers.
            onMouseDown={() => blurTimer.current && clearTimeout(blurTimer.current)}
          >
            {options.length === 0 && emptyHint ? (
              <li className="text-text-muted px-gutter py-3 text-sm">{emptyHint}</li>
            ) : null}

            {matches.map((option) => {
              const isSelected = option.id === value.id;

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose({ id: option.id })}
                    className={cn(
                      'min-h-touch px-gutter hover:bg-surface-muted flex w-full items-center gap-2 text-start text-sm',
                      isSelected && 'text-primary font-semibold',
                    )}
                  >
                    {isSelected ? (
                      <Check className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <span className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    {option.name}
                  </button>
                </li>
              );
            })}

            {matches.length === 0 && options.length > 0 && !canCreate ? (
              <li className="text-text-muted px-gutter py-3 text-sm">Nothing matches that name.</li>
            ) : null}

            {canCreate ? (
              <li className="border-outline-variant border-t">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => choose({ createName: query.trim() })}
                  className="min-h-touch px-gutter text-primary hover:bg-surface-muted flex w-full items-center gap-2 text-start text-sm font-semibold"
                >
                  <Plus className="size-4 shrink-0" aria-hidden="true" />
                  Create “{query.trim()}”
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {value.createName ? (
        // Stated plainly, because it is a side effect the admin should not
        // discover after the fact: saving this form will add a category that
        // shoppers can then see.
        <p className="text-secondary text-sm font-medium">
          “{value.createName}” will be created when you save, and will appear to shoppers.
        </p>
      ) : null}

      {error ? (
        <p id={messageId} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
