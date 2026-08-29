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
 * centred column on desktop. Desktop is a deliberate layout, not a stretched phone.
 */
export function Container({ children, className, bleed = false }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl', !bleed && 'px-page md:px-8', className)}>
      {children}
    </div>
  );
}
