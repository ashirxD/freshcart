'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { PRIMARY_NAV, isActiveRoute } from './navigation.config';

/**
 * Mobile primary navigation. Hidden from md upward, where DesktopNavigation
 * takes over.
 *
 * Every tab is a full 48px target with a persistent text label: icon-only tabs
 * are a real barrier for shoppers who are not fluent with app conventions.
 */
export function BottomNavigation({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface md:hidden',
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
                  'flex min-h-touch flex-col items-center justify-center gap-0.5 px-1 py-2',
                  'text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-text-muted',
                )}
              >
                <span className="relative">
                  <Icon
                    className={cn('size-6', active && 'stroke-[2.25]')}
                    aria-hidden="true"
                  />

                  {item.showsCartCount && cartCount > 0 ? (
                    <span
                      className={cn(
                        'absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center',
                        'rounded-full bg-secondary-container px-1 text-[10px] font-bold',
                        'text-on-secondary-container',
                      )}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
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
