'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Boxes, FolderTree, PackageSearch, ShieldAlert, Store } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

const ADMIN_NAV = [
  { href: '/admin/products', label: 'Products', icon: PackageSearch },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
];

/**
 * Back-office chrome, plus the client-side role gate.
 *
 * This gate is a *usability* measure, not a security boundary: it keeps a
 * customer from landing on a screen of controls that would all fail. Every
 * admin endpoint is guarded server-side by the ADMIN role, so a determined
 * visitor who renders this shell can still do nothing with it.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

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

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-outline-variant bg-surface sticky top-0 z-40 border-b">
        <Container className="gap-gutter flex flex-wrap items-center py-3">
          <Link href="/admin/products" className="text-primary flex items-center gap-2">
            <Store className="size-5" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">FreshCarts admin</span>
          </Link>

          <nav aria-label="Back office" className="flex flex-1 items-center gap-1">
            {ADMIN_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'min-h-touch flex items-center gap-2 rounded-full px-4 text-sm font-medium',
                    active ? 'bg-surface-muted text-primary' : 'text-text-muted hover:text-text',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link href="/" className="text-primary text-sm font-medium">
            View store
          </Link>
        </Container>
      </header>

      <main id="main-content" className="py-lg flex-1">
        {children}
      </main>
    </div>
  );
}
