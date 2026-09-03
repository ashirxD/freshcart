'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface RadioCardGroupContext {
  name: string;
  value: string | null;
  onChange: (value: string) => void;
}

const GroupContext = createContext<RadioCardGroupContext | null>(null);

export interface RadioCardGroupProps {
  /** The group's question. Rendered as the fieldset legend. */
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  children: ReactNode;
  /** Hides the legend visually while keeping it for screen readers. */
  hideLabel?: boolean;
  error?: string;
  className?: string;
}

/**
 * A group of selectable cards that is a real radio group underneath.
 *
 * The temptation with "clickable cards" is a `<div onClick>` with an aria-role
 * bolted on. That loses arrow-key navigation between options, loses the "2 of
 * 3" announcement, loses form association, and loses the native focus ring —
 * all of which a shopper using a keyboard or a screen reader depends on.
 *
 * So the control here is a real `<input type="radio">`, visually hidden but
 * present and focusable, inside a `<fieldset>` with a `<legend>`. The card is
 * the label. Everything native keeps working, and the styling is driven by
 * `:has(:checked)` and `:has(:focus-visible)` rather than by JavaScript state.
 */
export function RadioCardGroup({
  label,
  value,
  onChange,
  children,
  hideLabel = false,
  error,
  className,
}: RadioCardGroupProps) {
  const name = useId();
  const errorId = name + '-error';

  return (
    <fieldset
      className={cn('gap-tight flex w-full flex-col', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend
        className={cn(
          'mb-tight text-text text-base font-bold tracking-[-0.015em]',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </legend>

      <GroupContext.Provider value={{ name, value, onChange }}>{children}</GroupContext.Provider>

      {error ? (
        <p id={errorId} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export interface RadioCardProps {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Rendered on the right — a price, a badge, a "Default" pill. */
  trailing?: ReactNode;
  /** Extra content below the description, e.g. a full address. */
  children?: ReactNode;
  disabled?: boolean;
  /** Shown instead of the description when disabled, explaining why. */
  disabledReason?: string;
  className?: string;
}

export function RadioCard({
  value,
  title,
  description,
  icon,
  trailing,
  children,
  disabled = false,
  disabledReason,
  className,
}: RadioCardProps) {
  const group = useContext(GroupContext);

  if (!group) {
    throw new Error('RadioCard must be rendered inside a RadioCardGroup');
  }

  const isSelected = group.value === value;

  return (
    <label
      className={cn(
        'gap-gutter p-gutter relative flex w-full cursor-pointer items-start rounded-xl border',
        // Comfortably above the 48px minimum, since the whole card is the target.
        'min-h-touch ease-standard transition-[border-color,background-color,box-shadow] duration-150',
        'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
        'has-[:focus-visible]:outline-offset-2',
        isSelected
          ? 'border-primary bg-cream shadow-card'
          : 'border-outline-variant bg-surface hover:border-primary/30 hover:bg-cream/50',
        disabled && 'hover:border-outline-variant hover:bg-surface cursor-not-allowed opacity-60',
        className,
      )}
    >
      {/* Visually hidden, but a real focusable radio: arrow keys, form
          association and screen-reader semantics all keep working. */}
      <input
        type="radio"
        name={group.name}
        value={value}
        checked={isSelected}
        disabled={disabled}
        onChange={() => group.onChange(value)}
        className="sr-only"
      />

      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
            isSelected ? 'bg-primary text-on-primary' : 'bg-surface-muted text-primary',
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-2">
          <span className="text-text text-base font-semibold">{title}</span>
          {trailing ? <span className="shrink-0 text-sm">{trailing}</span> : null}
        </span>

        {disabled && disabledReason ? (
          <span className="text-danger text-sm">{disabledReason}</span>
        ) : description ? (
          <span className="text-text-muted text-sm">{description}</span>
        ) : null}

        {children}
      </span>

      {/*
        A tick as well as the colour change. Selection must never be
        communicated by colour alone — that fails for anyone who cannot
        distinguish the border, and in high-contrast modes.
      */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
          isSelected ? 'border-primary bg-primary text-on-primary' : 'border-outline',
        )}
      >
        {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}
