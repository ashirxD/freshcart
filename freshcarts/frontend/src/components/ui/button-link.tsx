import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button';

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A link that looks like a button.
 *
 * This exists because `<Link><Button/></Link>` produces a `<button>` inside an
 * `<a>` — invalid HTML, and genuinely broken for assistive technology, which
 * sees two nested controls with one label between them. Navigation is an
 * anchor; only actions are buttons.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leadingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClasses({ variant, size, fullWidth, className })}>
      {leadingIcon}
      {children}
    </Link>
  );
}
