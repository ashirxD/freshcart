'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ClipboardList, LogOut, Settings, User } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { useLogout } from '@/features/auth/auth.hooks';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { ACCOUNT_NAV } from './navigation.config';

/**
 * THE ACCOUNT MENU
 *
 * The old header linked the signed-in shopper's name to `/account` — a route
 * that does not exist in this app, so the one control carrying a person's own
 * name led to a 404. This replaces it with the things they can actually do.
 *
 * It also solves §12's other problem: an admin or a store manager needs a way
 * into their console from the storefront, but the shopping navigation must not
 * be cluttered with operational links for the shoppers who are 99% of visitors.
 * So the console entry lives in here, under the account, where it belongs — and
 * it is a convenience, not a gate: both destinations enforce their own access
 * server-side.
 *
 * Implemented as a disclosure rather than an ARIA menu: these are links to
 * pages, not commands, and `role="menu"` would promise arrow-key semantics that
 * a list of anchors should not be pretending to have.
 */
export function AccountMenu() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const logout = useLogout();

  const [isOpen, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Any navigation closes the panel — otherwise it hangs over the new page.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (status !== 'authenticated' || !user) {
    return (
      <ButtonLink
        href={'/login?next=' + encodeURIComponent(pathname)}
        size="sm"
        leadingIcon={<User className="size-4" aria-hidden="true" />}
      >
        Sign in
      </ButtonLink>
    );
  }

  const firstName = user.fullName.split(' ')[0];

  const backOffice =
    user.role === 'STORE_MANAGER'
      ? { href: '/store-manager', label: 'Store console', icon: ClipboardList }
      : user.role === 'ADMIN'
        ? { href: '/admin', label: 'Admin console', icon: Settings }
        : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="account-menu-panel"
        className={cn(
          'min-h-touch flex items-center gap-2 rounded-full py-1 ps-1 pe-3',
          'ease-standard transition-colors duration-150',
          isOpen ? 'bg-primary/10' : 'hover:bg-primary/8',
        )}
      >
        <span
          aria-hidden="true"
          className="bg-primary text-on-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        >
          {firstName.slice(0, 1).toUpperCase()}
        </span>

        <span className="flex flex-col items-start leading-tight">
          <span className="text-text-muted text-[0.6875rem] font-medium">Account</span>
          <span className="text-text max-w-24 truncate text-sm font-semibold">{firstName}</span>
        </span>

        <ChevronDown
          className={cn(
            'text-outline ease-standard size-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          id="account-menu-panel"
          className={cn(
            'animate-sheet-up absolute end-0 top-full z-50 mt-2 w-64',
            'ring-outline-variant bg-surface shadow-overlay overflow-hidden rounded-2xl ring-1',
          )}
        >
          <div className="border-outline-variant bg-cream border-b px-4 py-3">
            <p className="text-text truncate text-sm font-bold">{user.fullName}</p>
            <p className="text-text-muted truncate text-xs">{user.phone}</p>
          </div>

          <nav aria-label="Account">
            <ul className="p-1.5">
              {ACCOUNT_NAV.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-text hover:bg-surface-muted flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-colors"
                    >
                      <Icon className="text-outline size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}

              {backOffice ? (
                <li className="border-outline-variant mt-1.5 border-t pt-1.5">
                  <Link
                    href={backOffice.href}
                    className="text-primary hover:bg-primary/8 flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold transition-colors"
                  >
                    <backOffice.icon className="size-4 shrink-0" aria-hidden="true" />
                    {backOffice.label}
                  </Link>
                </li>
              ) : null}

              <li className="border-outline-variant mt-1.5 border-t pt-1.5">
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="text-text-muted hover:bg-danger/8 hover:text-danger flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden="true" />
                  {logout.isPending ? 'Signing out…' : 'Sign out'}
                </button>
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
