import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { BottomNavigation } from './bottom-navigation';
import { DesktopNavigation } from './desktop-navigation';

export interface AppShellProps {
  children: ReactNode;
  /** Screens such as checkout hide the primary navigation to reduce drop-off. */
  hideNavigation?: boolean;
  className?: string;
}

/**
 * The customer-facing chrome: one header for desktop, one tab bar for mobile,
 * and a main region that always clears the fixed bottom bar.
 */
export function AppShell({ children, hideNavigation = false, className }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {!hideNavigation ? <DesktopNavigation /> : null}

      <main
        className={cn(
          'flex-1',
          // Reserve space for the mobile tab bar so content is never hidden by it.
          !hideNavigation && 'pb-20 md:pb-0',
          className,
        )}
      >
        {children}
      </main>

      {!hideNavigation ? <BottomNavigation /> : null}
    </div>
  );
}
