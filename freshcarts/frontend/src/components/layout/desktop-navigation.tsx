'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, Settings, ShoppingCart, User } from 'lucide-react';
import { SearchBar } from '@/components/common/search-bar';
import { useCartCount } from '@/features/cart/cart.hooks';
import { cn } from '@/lib/cn';
import { formatBadgeCount } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { PRIMARY_NAV, SECONDARY_NAV, isActiveRoute } from './navigation.config';

/**
 * Desktop header. Deliberately a different composition from the mobile tab bar:
 * search is promoted into the header (there is room for it), and cart/account
 * move to the right rail rather than competing for tab space.
 */
export function DesktopNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const cartCount = useCartCount();

  const backOffice =
    user?.role === 'STORE_MANAGER'
      ? { href: '/store-manager', label: 'Store console', icon: ClipboardList }
      : user?.role === 'ADMIN'
        ? { href: '/admin/products', label: 'Admin', icon: Settings }
        : null;

  // Search and cart get dedicated affordances here, so they are dropped from the links.
  const links = PRIMARY_NAV.filter((item) => !['/search', '/cart'].includes(item.href));

  return (
    <header className="border-outline-variant bg-surface sticky top-0 z-40 hidden border-b md:block">
      <div className="gap-lg mx-auto flex w-full max-w-6xl items-center px-8 py-3">
        <Link href="/" className="text-primary shrink-0 text-xl font-bold tracking-tight">
          FreshCarts
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {links.map((item) => {
            const active = isActiveRoute(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-surface-muted text-primary' : 'text-text-muted hover:text-text',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <SearchBar
            onSubmit={(term) => router.push('/search?q=' + encodeURIComponent(term))}
            className="max-w-md"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/*
            Back-office roles get a way in from the storefront. Without it a
            manager who signs in lands here with no route to the console they
            actually need. Rendered from the role on the verified session, so it
            simply is not there for a shopper — and it is a convenience, not a
            gate: both destinations enforce their own access server-side.
          */}
          {backOffice ? (
            <Link
              href={backOffice.href}
              className="min-h-touch text-primary hover:bg-surface-muted flex items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
            >
              <backOffice.icon className="size-4" aria-hidden="true" />
              {backOffice.label}
            </Link>
          ) : null}

          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label + ' items'}
                className={cn(
                  'size-touch hover:bg-surface-muted flex items-center justify-center rounded-full',
                  isActiveRoute(pathname, item.href) ? 'text-primary' : 'text-text',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </Link>
            );
          })}

          <Link
            href="/cart"
            aria-label={'Cart, ' + cartCount + ' items'}
            className="size-touch text-text hover:bg-surface-muted relative flex items-center justify-center rounded-full"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {cartCount > 0 ? (
              <span className="bg-secondary-container text-on-secondary-container absolute top-2 right-2 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                {formatBadgeCount(cartCount)}
              </span>
            ) : null}
          </Link>

          <Link
            href={user ? '/account' : '/login'}
            className="min-h-touch text-text hover:bg-surface-muted flex items-center gap-2 rounded-full px-3 text-sm font-medium"
          >
            <User className="size-5" aria-hidden="true" />
            {user ? user.fullName.split(' ')[0] : 'Sign in'}
          </Link>
        </div>
      </div>
    </header>
  );
}
