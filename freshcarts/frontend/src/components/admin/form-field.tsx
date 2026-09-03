'use client';

import {
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Form primitives for the back office.
 *
 * `Input` from the UI kit already covers text fields; these add the select,
 * textarea and checkbox that admin forms need, with the same label-is-mandatory
 * rule so no field is ever identifiable by placeholder alone.
 */

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

function FieldShell({ label, hint, error, children, className }: FieldShellProps) {
  const id = useId();
  const messageId = id + '-message';
  const invalid = Boolean(error);

  return (
    <div className={cn('gap-tight flex w-full flex-col', className)}>
      <label htmlFor={id} className="text-text text-sm font-medium">
        {label}
      </label>

      {children({ id, describedBy: error || hint ? messageId : undefined, invalid })}

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

const CONTROL_CLASS =
  'w-full rounded-md border bg-surface px-gutter py-3 text-base text-text outline-none ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20';

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className'
> {
  label: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  /** Prepended as an empty-valued option, e.g. "None (top level)". */
  placeholder?: string;
  className?: string;
}

export function SelectField({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          {...props}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            CONTROL_CLASS,
            'min-h-touch',
            invalid ? 'border-danger' : 'border-outline-variant',
          )}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export interface TextareaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'className'
> {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

export function TextareaField({ label, hint, error, className, ...props }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...props}
          id={id}
          rows={props.rows ?? 4}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            CONTROL_CLASS,
            'resize-y',
            invalid ? 'border-danger' : 'border-outline-variant',
          )}
        />
      )}
    </FieldShell>
  );
}

export interface CheckboxFieldProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** A full-row target rather than a bare 16px box, which is unusable on a phone. */
export function CheckboxField({ label, hint, checked, onChange, className }: CheckboxFieldProps) {
  const id = useId();

  return (
    <div className={cn('min-h-touch flex items-start gap-3 py-2', className)}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]"
      />
      <label htmlFor={id} className="flex flex-col gap-0.5">
        <span className="text-text text-sm font-medium">{label}</span>
        {hint ? <span className="text-text-muted text-sm">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Groups related fields with a visible heading, so long forms stay scannable. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-text text-base font-semibold">{title}</h2>
        {description ? <p className="text-text-muted text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
