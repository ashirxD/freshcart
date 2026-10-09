'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ShoppingBasket } from 'lucide-react';
import { useCart, useCartCount } from '@/features/cart/cart.hooks';
import { Money } from '@/components/common/ltr';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import { CartCountBadge } from './cart-count-badge';
import { MOBILE_NAV, isActiveRoute } from './navigation.config';

/** Routes where a "view your basket" bar would be pointing at the current page. */
const CART_BAR_EXCLUDED = ['/cart', '/checkout'];

/**
 * MOBILE PRIMARY NAVIGATION, plus the basket bar that rides above it.
 *
 * Hidden from md upward, where the desktop header takes over.
 *
 * Every tab is a full 48px target with a persistent text label: icon-only tabs
 * are a real barrier for shoppers who are not fluent with app conventions. The
 * current tab gets a tinted tray behind its icon as well as a colour change, so
 * it is identifiable without relying on hue.
 *
 * THE BASKET BAR (§52)
 * A running total is the one thing a grocery shopper checks constantly, and on
 * a phone it was three taps away. This puts it permanently in reach — but only
 * when there is something in the basket, and never on the basket or checkout
 * screens, where it would be a button pointing at the page you are on.
 *
 * WHY THE SPACER
 * Both bars are fixed, so they cannot push content. This component therefore
 * also renders a normal-flow spacer of exactly its own height, in the same
 * conditional — which means the page can never end underneath them, and the
 * reserved space shrinks back the moment the basket is empty (§52).
 */
export function BottomNavigation() {
  const pathname = usePathname();
  // Read straight from the cart cache: the badge and the total then update the
  // moment a mutation writes the new cart, with no prop threading.
  const cartCount = useCartCount();
  const { data: cart } = useCart();
  const t = useT();

  const showsCartBar =
    cartCount > 0 && !CART_BAR_EXCLUDED.some((route) => pathname.startsWith(route));

  return (
    <>
      {/* Reserves exactly what the fixed bars occupy. */}
      <div
        aria-hidden="true"
        className={cn(
          'shrink-0 md:hidden',
          showsCartBar
            ? 'h-[calc(var(--nav-height)+var(--cart-bar-height)+var(--safe-bottom))]'
            : 'h-[calc(var(--nav-height)+var(--safe-bottom))]',
        )}
      />

      {showsCartBar && cart ? (
        <div className="px-page fixed inset-x-0 bottom-[calc(var(--nav-height)+var(--safe-bottom))] z-40 pb-2 md:hidden">
          <Link
            href="/cart"
            className={cn(
              'bg-primary text-on-primary shadow-raised animate-sheet-up',
              'flex min-h-14 items-center gap-3 rounded-2xl px-3',
              'ease-standard transition-[background-color,transform] duration-150',
              'active:translate-y-px',
            )}
          >
            <span
              aria-hidden="true"
              className="bg-on-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl"
            >
              <ShoppingBasket className="size-5" />
            </span>

            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-on-primary/80 text-xs font-medium">
                {t('nav.itemsInBasket', {
                  items: t('common.itemCount', { count: cart.totalQuantity }),
                })}
              </span>
              <span className="text-base font-extrabold tabular-nums">
                <Money>{formatPkr(cart.subtotal)}</Money>
              </span>
            </span>

            <span className="ms-auto flex shrink-0 items-center gap-1 text-sm font-bold">
              {t('nav.view')}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </span>
          </Link>
        </div>
      ) : null}

      <nav
        aria-label={t('nav.primary')}
        className={cn(
          'border-outline-variant bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden',
          // Keeps the bar clear of the iOS home indicator.
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <ul className="flex h-[var(--nav-height)] items-stretch justify-around">
          {MOBILE_NAV.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            const label =
              item.showsCartCount && cartCount > 0
                ? t('nav.navItemWithCount', {
                    label: t(item.labelKey),
                    items: t('common.itemCount', { count: cartCount }),
                  })
                : undefined;

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                  className={cn(
                    'min-h-touch flex flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-2',
                    'text-[0.6875rem] font-semibold transition-colors duration-150',
                    active ? 'text-primary' : 'text-text-muted',
                  )}
                >
                  <span
                    className={cn(
                      'relative flex h-7 w-12 items-center justify-center rounded-full',
                      'ease-standard transition-colors duration-200',
                      active && 'bg-primary/10',
                    )}
                  >
                    <Icon
                      className={cn('size-5.5', active && 'stroke-[2.25]')}
                      aria-hidden="true"
                    />

                    {item.showsCartCount ? (
                      <CartCountBadge count={cartCount} className="end-1.5 top-0" />
                    ) : null}
                  </span>

                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
