'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Menu,
  PackageSearch,
  ShieldAlert,
  Store,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreDashboard } from '@/features/store-manager/store-manager.hooks';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

const NAV = [
  { href: '/store-manager', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/store-manager/orders', label: 'Orders', icon: ClipboardList },
  { href: '/store-manager/inventory', label: 'Inventory', icon: Boxes },
  { href: '/store-manager/products', label: 'Products', icon: PackageSearch },
];

/**
 * The operations console chrome.
 *
 * A left sidebar on desktop (§41), collapsing to a drawer on smaller screens.
 * Deliberately NOT the customer tab bar and NOT the admin header: staff are
 * working, not shopping, and the navigation should not offer them a cart.
 *
 * The role gate below is a *usability* measure, not a security boundary. It
 * keeps a customer off a screen of controls that would all fail. Every endpoint
 * behind it is guarded server-side by role and store, so someone who renders
 * this shell can still do nothing with it (§55).
 */
export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'loading') {
    return (
      <Container className="gap-gutter py-loose flex flex-col">
        <Skeleton className="h-8 w-56" label="Checking your access" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (!user || user.role !== 'STORE_MANAGER') {
    return (
      <Container className="py-loose">
        <EmptyState
          icon={<ShieldAlert aria-hidden="true" />}
          title="Store staff only"
          description="This is the store operations console. Sign in with a store manager account to continue."
          action={
            user ? (
              <ButtonLink href="/">Back to the store</ButtonLink>
            ) : (
              <Button onClick={() => router.push('/login?next=' + encodeURIComponent(pathname))}>
                Sign in
              </Button>
            )
          }
          className="bg-surface-muted rounded-2xl"
        />
      </Container>
    );
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col lg:flex-row">
      {/* Mobile header. The drawer trigger is a 48px target. */}
      <header className="border-outline-variant bg-surface sticky top-0 z-40 flex items-center gap-2 border-b px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={isDrawerOpen}
          className="hover:bg-primary/8 text-text size-touch flex items-center justify-center rounded-full transition-colors"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <StoreBadge className="min-w-0 flex-1" />
      </header>

      {/* Desktop sidebar. */}
      <aside className="border-outline-variant bg-surface hidden w-60 shrink-0 flex-col border-e lg:flex">
        <div className="border-outline-variant border-b p-4">
          <StoreBadge />
        </div>
        <SidebarNav pathname={pathname} />
      </aside>

      {/* Mobile drawer. Rendered only when open so it is out of the tab order. */}
      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="presentation">
          <div
            className="bg-text/40 absolute inset-0"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="Store navigation"
            className="bg-surface shadow-overlay relative z-10 flex w-64 flex-col"
          >
            <div className="border-outline-variant flex items-center justify-between gap-2 border-b p-4">
              <StoreBadge className="min-w-0" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="hover:bg-surface-muted text-outline size-touch flex shrink-0 items-center justify-center rounded-full"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </nav>
        </div>
      ) : null}

      <main id="main-content" className="py-loose min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Store operations" className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm',
              'ease-standard transition-colors duration-150',
              active
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-text-muted hover:bg-surface-muted hover:text-text font-medium',
            )}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="bg-leaf absolute inset-y-1.5 start-0 w-0.5 rounded-full"
              />
            ) : null}
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}

      <Link
        href="/"
        onClick={onNavigate}
        className="text-text-muted hover:text-text min-h-touch mt-auto flex items-center gap-3 rounded-md px-3 text-sm"
      >
        <Store className="size-5 shrink-0" aria-hidden="true" />
        View storefront
      </Link>
    </nav>
  );
}

/**
 * The store's identity and whether it is open.
 *
 * Shown because staff need to know which shop they are operating (§69), and
 * because "we are outside opening hours" explains why no new orders are
 * arriving. It is information only — nothing in the console acts on it.
 */
function StoreBadge({ className }: { className?: string }) {
  const { data } = useStoreDashboard();

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-primary truncate text-sm font-extrabold tracking-[-0.02em]">
        {data?.store.name ?? 'FreshCarts'}
      </span>

      {data ? (
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              // Open is the state that matters operationally, so it gets the
              // ring as well as the fill — visible in a high-contrast mode.
              data.store.isOpen ? 'bg-leaf ring-leaf/30 ring-2' : 'bg-outline',
            )}
            aria-hidden="true"
          />
          <span className={data.store.isOpen ? 'text-success' : 'text-text-muted'}>
            {data.store.isOpen ? 'Open' : 'Closed'}
          </span>
          <span className="text-text-muted truncate">· {data.store.area}</span>
        </span>
      ) : (
        <span className="text-text-muted text-xs">Store operations</span>
      )}
    </div>
  );
}
