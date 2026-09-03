'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, User } from 'lucide-react';
import { LogoLink } from '@/components/brand/logo';
import { IconLink } from '@/components/ui/icon-button';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { StoreLocation } from './store-location';

/**
 * MOBILE HEADER (§12, §53)
 *
 * There was no header on a phone at all: the app opened straight into content
 * with a tab bar at the foot, so there was no brand anywhere on the screen, no
 * indication of which shop was serving you, and search was one of the five
 * precious tab slots.
 *
 * This is one 56px row, and it is sticky, so all three of those are permanently
 * available: the mark (and a way home), the location, and search. Everything
 * else stays in the tab bar where a thumb can reach it — a header is the worst
 * place on a phone to put anything you tap often.
 *
 * The account entry is here rather than in the tab bar for the same reason it
 * is in the desktop header: it is visited occasionally, and the five tabs
 * belong to shopping.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  return (
    <header
      className={cn(
        'border-outline-variant bg-surface/95 sticky top-0 z-40 border-b backdrop-blur-md md:hidden',
        // Clears a notch when the page is installed to the home screen.
        'pt-[env(safe-area-inset-top)]',
      )}
    >
      <div className="px-page flex h-14 items-center gap-2">
        <LogoLink markOnly size="sm" className="min-h-11 items-center" />

        {/* Takes the slack, and truncates rather than pushing the actions off
            the edge on a 320px screen. */}
        <StoreLocation className="min-w-0 flex-1" />

        <IconLink
          href="/search"
          label="Search products"
          isCurrent={pathname.startsWith('/search')}
          className="size-11"
        >
          <Search className="size-5" aria-hidden="true" />
        </IconLink>

        {user ? (
          <IconLink href="/orders" label="Your account and orders" className="size-11">
            {/* The initial doubles as an avatar, so a signed-in shopper can see
                at a glance that they are signed in. */}
            <span
              aria-hidden="true"
              className="bg-primary text-on-primary flex size-8 items-center justify-center rounded-full text-xs font-bold"
            >
              {user.fullName.slice(0, 1).toUpperCase()}
            </span>
          </IconLink>
        ) : (
          <Link
            href={'/login?next=' + encodeURIComponent(pathname)}
            className="text-primary bg-primary/8 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
          >
            <User className="size-4" aria-hidden="true" />
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
