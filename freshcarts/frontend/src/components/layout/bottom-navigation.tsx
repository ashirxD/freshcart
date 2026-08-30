'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCartCount } from '@/features/cart/cart.hooks';
import { cn } from '@/lib/cn';
import { formatBadgeCount } from '@/lib/format';
import { PRIMARY_NAV, isActiveRoute } from './navigation.config';

/**
 * Mobile primary navigation. Hidden from md upward, where DesktopNavigation
 * takes over.
 *
 * Every tab is a full 48px target with a persistent text label: icon-only tabs
 * are a real barrier for shoppers who are not fluent with app conventions.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  // Read straight from the cart cache: the badge then updates the moment a
  // mutation writes the new cart, with no prop threading through the layout.
  const cartCount = useCartCount();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'border-outline-variant bg-surface fixed inset-x-0 bottom-0 z-40 border-t md:hidden',
        // Keeps the bar clear of the iOS home indicator.
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="flex items-stretch justify-around">
        {PRIMARY_NAV.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'min-h-touch flex flex-col items-center justify-center gap-0.5 px-1 py-2',
                  'text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-text-muted',
                )}
              >
                <span className="relative">
                  <Icon className={cn('size-6', active && 'stroke-[2.25]')} aria-hidden="true" />

                  {item.showsCartCount && cartCount > 0 ? (
                    <span
                      className={cn(
                        'absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center',
                        'bg-secondary-container rounded-full px-1 text-[10px] font-bold',
                        'text-on-secondary-container',
                      )}
                    >
                      {formatBadgeCount(cartCount)}
                    </span>
                  ) : null}
                </span>

                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
