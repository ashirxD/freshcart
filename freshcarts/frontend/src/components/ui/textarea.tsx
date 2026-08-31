import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
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
  const hasError = Boolean(error);

  return (
    <div className="flex w-full flex-col gap-xs">
      <label htmlFor={fieldId} className={cn('text-sm font-medium text-text', hideLabel && 'sr-only')}>
        {label}
      </label>

      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={hasError || undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(
          'w-full rounded-md border bg-surface px-gutter py-3 text-base text-text',
          'placeholder:text-outline outline-none transition-colors',
          'focus:border-primary focus:ring-2 focus:ring-primary/20',
          hasError ? 'border-danger' : 'border-outline-variant',
          className,
        )}
        {...props}
      />

      {error ? (
        <p id={messageId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
