import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ContainerProps {
  children: ReactNode;
  className?: string;
  /** Removes horizontal padding for edge-to-edge sections such as carousels. */
  bleed?: boolean;
}

/**
 * The one place the page margin is defined: 20px on mobile, widening into a
 * centred column on desktop. Desktop is a deliberate layout, not a stretched
 * phone.
 *
 * The column is 1280px rather than the old 1152px. At the previous width a
 * five-column product grid gave each card 200px on a 1440px display and left
 * broad dead margins either side. The full-bleed tinted section bands do the
 * rest of the work at 1920px, so the reading column never has to stretch to
 * fill the glass.
 */
export function Container({ children, className, bleed = false }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl', !bleed && 'px-page md:px-8', className)}>
      {children}
    </div>
  );
}
