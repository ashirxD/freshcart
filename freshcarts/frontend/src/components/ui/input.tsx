import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
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
}

/**
 * A label is mandatory, not optional: placeholder-only fields are one of the
 * biggest usability failures for shoppers with limited digital literacy, since
 * the prompt disappears the moment they start typing.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leadingIcon, trailingSlot, hideLabel = false, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = props.name ? props.name + '-' + generatedId : generatedId;
  const messageId = inputId + '-message';
  const hasError = Boolean(error);

  return (
    <div className="flex w-full flex-col gap-xs">
      <label
        htmlFor={inputId}
        className={cn(
          'text-sm font-medium text-text',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>

      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-surface px-gutter',
          'min-h-touch transition-colors',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          hasError ? 'border-danger' : 'border-outline-variant',
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
          className={cn(
            'w-full bg-transparent py-3 text-base text-text outline-none',
            'placeholder:text-outline',
            className,
          )}
          {...props}
        />

        {trailingSlot ? <span className="shrink-0">{trailingSlot}</span> : null}
      </div>

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
