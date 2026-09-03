import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Variant styles are a plain lookup rather than a class-variance library — the
 * matrix is small and an extra dependency would not earn its place.
 *
 * Each variant states its own hover, active and disabled treatment, because a
 * control that only changes colour on hover is invisible to anyone who cannot
 * distinguish the two shades (§46). Every one of these also moves: primary and
 * secondary lift on hover and settle on press, so the press is felt as well as
 * seen.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-primary text-on-primary shadow-card',
    'hover:bg-primary-container hover:shadow-raised',
    'active:bg-primary active:shadow-card active:translate-y-px',
  ),
  secondary: cn(
    // The warm accent action: promotions, "scan your list", the second CTA in
    // a hero. Never used beside a primary for the same job.
    'bg-secondary-container text-on-secondary-container shadow-card',
    'hover:brightness-[0.97] hover:shadow-raised',
    'active:brightness-95 active:shadow-card active:translate-y-px',
  ),
  outline: cn(
    'border border-outline-variant bg-surface text-text',
    'hover:border-primary/35 hover:bg-cream',
    'active:bg-surface-muted active:translate-y-px',
  ),
  ghost: cn('text-primary bg-transparent', 'hover:bg-primary/8 active:bg-primary/12'),
  danger: cn(
    'bg-danger text-on-danger shadow-card',
    'hover:brightness-[0.94] hover:shadow-raised',
    'active:brightness-90 active:shadow-card active:translate-y-px',
  ),
};

/**
 * Every size meets the 48px minimum touch target except `sm`, which is reserved
 * for controls that sit inside an already-tappable row (e.g. a card action).
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-10 gap-1.5 px-snug text-sm rounded-md',
  md: 'min-h-touch gap-2 px-loose text-[0.9375rem] rounded-lg',
  lg: 'min-h-touch h-14 gap-2.5 px-wide text-base rounded-lg',
};

export interface ButtonAppearance {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * Fully rounded. Reserved for genuinely small or floating controls — a
   * rounded-rectangle button is the app's default so that pills keep meaning
   * "this is a chip, a tag or a status" (§9).
   */
  pill?: boolean;
  className?: string;
}

/**
 * The shared appearance, so a link that should look like a button does not have
 * to re-declare it — and cannot drift from the real thing.
 */
export function buttonClasses(options: ButtonAppearance): string {
  return cn(
    'inline-flex select-none items-center justify-center font-semibold',
    'transition-[background-color,box-shadow,transform,border-color,filter]',
    'duration-150 ease-standard',
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
    VARIANTS[options.variant ?? 'primary'],
    SIZES[options.size ?? 'md'],
    options.pill && 'rounded-full',
    options.fullWidth && 'w-full',
    options.className,
  );
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonAppearance, 'className'> {
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    pill = false,
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
      className={buttonClasses({ variant, size, fullWidth, pill, className })}
      {...props}
    >
      {isLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!isLoading && trailingIcon}
    </button>
  );
});
