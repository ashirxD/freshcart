'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { BottomNavigation } from './bottom-navigation';
import { DesktopNavigation } from './desktop-navigation';
import { MobileHeader } from './mobile-header';
import { SiteFooter } from './site-footer';

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Routes that run without the shopping chrome.
 *
 * Checkout is the whole list. It has its own sticky "Place order" bar at the
 * foot of the screen, and the tab bar sat on top of that on a phone — so the
 * primary action of the most important screen in the app was partly covered by
 * navigation the shopper should not be using mid-purchase anyway. The header
 * stays, so there is still a way out; only the foot of the screen is cleared.
 *
 * The confirmation page deliberately is NOT in this list: once the order is
 * placed, a shopper wants to get back to browsing.
 */
const FOCUSED_ROUTES = ['/checkout'];

/**
 * The customer-facing chrome.
 *
 * Four pieces, each doing a job the other three cannot: a slim mobile header
 * (brand, location, search), a two-band desktop header, a mobile tab bar with
 * the basket total riding above it, and a deep-green footer that closes the
 * page.
 */
export function AppShell({ children, className }: AppShellProps) {
  const pathname = usePathname();

  const isFocused = FOCUSED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
  // The confirmation screen lives under /checkout but is not part of the flow.
  const isFocusedFlow = isFocused && !pathname.startsWith('/checkout/confirmation');

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <MobileHeader />
      <DesktopNavigation />

      <main id="main-content" className={cn('flex-1', className)}>
        {children}
      </main>

      {!isFocusedFlow ? (
        <>
          <SiteFooter />
          <BottomNavigation />
        </>
      ) : null}
    </div>
  );
}
