'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Helper text shown under the field when there is no error. */
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  /** Hides the label visually while keeping it available to screen readers. */
  hideLabel?: boolean;
  /**
   * Forces left-to-right entry. Inferred for phone, email, URL and numeric
   * fields; set it for anything else that is a code rather than a sentence
   * (a SKU, a barcode).
   */
  ltr?: boolean;
}

/** The kinds of field whose content is read left-to-right whatever the page language is. */
const LTR_TYPES = new Set(['tel', 'email', 'url', 'number']);
const LTR_INPUT_MODES = new Set(['tel', 'email', 'url', 'numeric', 'decimal']);

/**
 * A label is mandatory, not optional: placeholder-only fields are one of the
 * biggest usability failures for shoppers with limited digital literacy, since
 * the prompt disappears the moment they start typing.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leadingIcon, trailingSlot, hideLabel = false, ltr, className, ...props },
  ref,
) {
  const { tm, isRtl } = useI18n();
  // A phone number typed into an Urdu form is still 0300 1234567, left to right.
  // It keeps that order, and in a right-to-left layout it sits against the
  // right-hand edge like every other field instead of floating at the left.
  const isLtrField =
    ltr ?? (LTR_TYPES.has(props.type ?? '') || LTR_INPUT_MODES.has(props.inputMode ?? ''));
  const generatedId = useId();
  const inputId = props.name ? props.name + '-' + generatedId : generatedId;
  const messageId = inputId + '-message';
  const hasError = Boolean(error);

  return (
    <div className="gap-tight flex w-full flex-col">
      <label
        htmlFor={inputId}
        className={cn('text-text text-sm font-semibold', hideLabel && 'sr-only')}
      >
        {label}
      </label>

      <div
        className={cn(
          'px-gutter flex items-center gap-2 rounded-lg border',
          'min-h-touch ease-standard transition-[border-color,box-shadow,background-color] duration-150',
          // The focused field lifts off the page rather than only changing its
          // border colour, which is the state most easily missed at a glance.
          'focus-within:border-primary focus-within:ring-primary/15 focus-within:bg-surface focus-within:ring-4',
          hasError
            ? 'border-danger bg-danger/4'
            : 'border-outline-variant bg-surface hover:border-outline/50',
        )}
      >
        {leadingIcon ? (
          <span className="text-outline shrink-0" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={error || hint ? messageId : undefined}
          dir={isLtrField ? 'ltr' : undefined}
          className={cn(
            'text-text w-full bg-transparent py-3 text-base outline-none',
            'placeholder:text-outline',
            isLtrField && isRtl && 'text-right',
            className,
          )}
          {...props}
        />

        {trailingSlot ? <span className="shrink-0">{trailingSlot}</span> : null}
      </div>

      {error ? (
        <p id={messageId} role="alert" className="text-danger text-sm font-medium">
          {tm(error)}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-text-muted text-sm">
          {tm(hint)}
        </p>
      ) : null}
    </div>
  );
});
