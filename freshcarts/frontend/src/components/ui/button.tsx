import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Variant styles are a plain lookup rather than a class-variance library — the
 * matrix is small and an extra dependency would not earn its place.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container active:bg-primary-container',
  secondary:
    'bg-secondary-container text-on-secondary-container hover:brightness-95 active:brightness-90',
  outline: 'border border-outline text-text bg-transparent hover:bg-surface-muted',
  ghost: 'text-primary bg-transparent hover:bg-surface-muted',
  danger: 'bg-danger text-on-danger hover:brightness-95',
};

/**
 * Every size meets the 48px minimum touch target except `sm`, which is reserved
 * for controls that sit inside an already-tappable row (e.g. a card action).
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-10 px-gutter text-sm gap-2',
  md: 'min-h-touch px-lg text-base gap-2',
  lg: 'min-h-touch h-14 px-lg text-lg gap-2.5',
};

/**
 * The shared appearance, so a link that should look like a button does not have
 * to re-declare it — and cannot drift from the real thing.
 */
export function buttonClasses(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  return cn(
    'inline-flex items-center justify-center rounded-full font-medium',
    'transition-colors duration-150 select-none',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[options.variant ?? 'primary'],
    SIZES[options.size ?? 'md'],
    options.fullWidth && 'w-full',
    options.className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? isLoading}
      // Communicates the pending state to assistive technology, not just visually.
      aria-busy={isLoading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {isLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!isLoading && trailingIcon}
    </button>
  );
});
