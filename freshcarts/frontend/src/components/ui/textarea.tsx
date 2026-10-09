'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

/**
 * The multi-line counterpart to Input, with the same rule: a label is
 * mandatory. Placeholder-only fields disappear the moment someone starts
 * typing, which is worst for exactly the shoppers this app is built for.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, hideLabel = false, className, rows = 3, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = props.name ? props.name + '-' + generatedId : generatedId;
  const messageId = fieldId + '-message';
  const { tm } = useI18n();
  const hasError = Boolean(error);

  return (
    <div className="gap-tight flex w-full flex-col">
      <label
        htmlFor={fieldId}
        className={cn('text-text text-sm font-semibold', hideLabel && 'sr-only')}
      >
        {label}
      </label>

      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={hasError || undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(
          'px-gutter text-text w-full rounded-lg border py-3 text-base',
          'placeholder:text-outline outline-none',
          'ease-standard transition-[border-color,box-shadow] duration-150',
          'focus:border-primary focus:ring-primary/15 focus:ring-4',
          hasError ? 'border-danger bg-danger/4' : 'border-outline-variant bg-surface',
          className,
        )}
        {...props}
      />

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
