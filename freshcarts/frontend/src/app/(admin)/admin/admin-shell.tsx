'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  FolderTree,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Receipt,
  Settings,
  ShieldAlert,
  Store,
  Truck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

/**
 * Every entry here leads to a screen that exists and works. Section 6 is
 * explicit about not shipping navigation into unfinished pages — a dead link in
 * a back office is worse than a missing one, because it looks like a fault.
 *
 * Grouped the way the work is: what is happening now, what is being sold, who
 * is involved, and how the platform is configured.
 */
const ADMIN_NAV = [
  {
    heading: 'Operations',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/admin/orders', label: 'Orders', icon: Receipt },
    ],
  },
  {
    heading: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products', icon: PackageSearch },
      { href: '/admin/categories', label: 'Categories', icon: FolderTree },
      { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    heading: 'People',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/store-managers', label: 'Store managers', icon: UserCog },
      { href: '/admin/stores', label: 'Stores', icon: Store },
    ],
  },
  {
    heading: 'Configuration',
    items: [
      { href: '/admin/delivery-pricing', label: 'Delivery pricing', icon: Truck },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
] as const;

function isCurrent(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}

/**
 * Back-office chrome, plus the client-side role gate.
 *
 * The gate is a *usability* measure, not a security boundary: it keeps a
 * customer from landing on a screen of controls that would all fail. Every
 * admin endpoint is guarded server-side by the ADMIN role, so a determined
 * visitor who renders this shell can still do nothing with it.
 *
 * Layout follows section 64: a persistent sidebar from `lg` up, where an admin
 * actually works, and a disclosure drawer below it so the same screens stay
 * reachable on a tablet or a phone without a second navigation model.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const [isMenuOpen, setMenuOpen] = useState(false);

  if (status === 'loading') {
    return (
      <Container className="gap-gutter py-lg flex flex-col">
        <Skeleton className="h-8 w-48" label="Checking your access" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <Container className="py-lg">
        <EmptyState
          icon={<ShieldAlert className="size-7" aria-hidden="true" />}
          title="Admin access only"
          description="This area is for store administrators. Sign in with an admin account to continue."
          action={
            <Button
              variant="primary"
              onClick={() =>
                router.push(user ? '/' : '/login?next=' + encodeURIComponent(pathname))
              }
            >
              {user ? 'Back to the store' : 'Sign in'}
            </Button>
          }
          className="bg-surface-muted rounded-lg"
        />
      </Container>
    );
  }

  const navigation = (
    <nav aria-label="Back office" className="gap-lg flex flex-col">
      {ADMIN_NAV.map((group) => (
        <div key={group.heading} className="gap-xs flex flex-col">
          <h2 className="text-text-muted px-3 text-xs font-semibold tracking-wide uppercase">
            {group.heading}
          </h2>

          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isCurrent(pathname, item.href, 'exact' in item && item.exact);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'min-h-touch flex items-center gap-3 rounded-lg px-3 text-sm',
                      // Weight as well as colour: the current page must be
                      // identifiable without relying on hue alone.
                      active
                        ? 'bg-surface-muted text-primary font-semibold'
                        : 'text-text-muted hover:bg-surface-muted hover:text-text font-medium',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-outline-variant bg-surface sticky top-0 z-40 border-b">
        <div className="px-page gap-gutter mx-auto flex w-full max-w-[1400px] flex-wrap items-center py-3">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="admin-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            leadingIcon={
              isMenuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )
            }
          >
            <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
          </Button>

          <Link href="/admin" className="text-primary flex items-center gap-2">
            <Store className="size-5" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">FreshCarts admin</span>
          </Link>

          <div className="gap-gutter ms-auto flex items-center">
            <span className="text-text-muted hidden text-sm sm:inline">{user.fullName}</span>
            <Link
              href="/"
              className="text-primary min-h-touch flex items-center text-sm font-medium"
            >
              View store
            </Link>
          </div>
        </div>
      </header>

      <div className="px-page gap-lg mx-auto flex w-full max-w-[1400px] flex-1">
        {/* Persistent on desktop, where an admin works. */}
        <aside className="py-lg hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">{navigation}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {isMenuOpen ? (
            <div
              id="admin-navigation"
              className="border-outline-variant bg-surface p-gutter mt-gutter rounded-lg border lg:hidden"
            >
              {navigation}
            </div>
          ) : null}

          <main id="main-content" className="py-lg">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
