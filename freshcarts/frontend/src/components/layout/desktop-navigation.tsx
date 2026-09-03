'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Phone, ShoppingBasket, Truck } from 'lucide-react';
import { LogoLink } from '@/components/brand/logo';
import { SearchBar } from '@/components/common/search-bar';
import { IconLink } from '@/components/ui/icon-button';
import { useCartCount } from '@/features/cart/cart.hooks';
import { useCurrentStore } from '@/features/catalog/catalog.hooks';
import { cn } from '@/lib/cn';
import { AccountMenu } from './account-menu';
import { CartCountBadge } from './cart-count-badge';
import { DESKTOP_NAV, HEADER_ACTIONS, isActiveRoute } from './navigation.config';
import { StoreLocation } from './store-location';

/**
 * DESKTOP HEADER (§12, §55)
 *
 * Two bands, because they answer two different questions.
 *
 * The thin deep-green strip on top is the shop: which branch is serving you,
 * that both delivery and pickup exist, and the number you can ring. Every value
 * in it comes from the store record — nothing is asserted that the API did not
 * return. It also gives the page a branded top edge, which is most of what the
 * old single-line header was missing.
 *
 * Under it is the shopping bar: brand, three destinations, search, and the
 * personal shelf (saved, basket, account) pushed to the right where a shopper
 * expects to find it. It is the only band that sticks.
 *
 * Operational navigation is deliberately absent. A manager's route into the
 * console lives in the account menu, so a shopper — who is almost every visitor
 * — never sees a link they cannot use.
 */
export function DesktopNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const cartCount = useCartCount();
  const { data: store } = useCurrentStore();

  return (
    <div className="hidden md:block">
      {/* --- The shop strip ------------------------------------------------ */}
      <div className="bg-primary text-cream">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-8 py-2 text-xs">
          <StoreLocation tone="onDark" />

          <span className="text-cream/75 flex items-center gap-1.5">
            <Truck className="size-3.5" aria-hidden="true" />
            Delivery or collect in store
          </span>

          {store?.phone ? (
            <a
              href={'tel:' + store.phone}
              className="text-cream/75 hover:text-cream -my-1 ms-auto flex min-h-8 items-center gap-1.5 rounded px-1.5 transition-colors"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              {store.phone}
            </a>
          ) : null}
        </div>
      </div>

      {/* --- The shopping bar --------------------------------------------- */}
      <header
        className={cn(
          'border-outline-variant bg-surface/95 sticky top-0 z-40 border-b backdrop-blur-md',
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-5 px-8 py-2.5">
          <LogoLink />

          <nav aria-label="Primary" className="flex items-center gap-0.5">
            {DESKTOP_NAV.map((item) => {
              const active = isActiveRoute(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150',
                    active ? 'text-primary' : 'text-text-muted hover:text-text',
                  )}
                >
                  {item.label}

                  {/*
                    A leaf-green underline for the current section rather than a
                    filled pill: the pill made every link look like a button and
                    competed with the actual buttons on the right.
                  */}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="bg-leaf absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            <SearchBar
              onSubmit={(term) => router.push('/search?q=' + encodeURIComponent(term))}
              className="mx-auto max-w-md"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {HEADER_ACTIONS.map((item) => {
              const Icon = item.icon;

              return (
                <IconLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  isCurrent={isActiveRoute(pathname, item.href)}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </IconLink>
              );
            })}

            <IconLink
              href="/cart"
              label={'Basket, ' + (cartCount === 1 ? '1 item' : cartCount + ' items')}
              isCurrent={isActiveRoute(pathname, '/cart')}
            >
              <ShoppingBasket className="size-5" aria-hidden="true" />
              <CartCountBadge count={cartCount} className="end-1.5 top-1.5" />
            </IconLink>

            <div className="bg-outline-variant mx-1 h-8 w-px" aria-hidden="true" />

            <AccountMenu />
          </div>
        </div>
      </header>
    </div>
  );
}
