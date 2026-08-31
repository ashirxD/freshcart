'use client';

import { Receipt, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { OrderCard } from '@/components/orders/order-card';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrders } from '@/features/orders/orders.hooks';
import { useAuthStore } from '@/store/auth.store';
import { useState } from 'react';

/**
 * Order history.
 *
 * Paginated rather than infinite: a shopper looking for a past order wants to
 * page back through dates, and an unbounded list would eventually pull hundreds
 * of orders in one request for no benefit.
 */
export function OrdersScreen() {
  const sessionStatus = useAuthStore((state) => state.status);
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch, isFetching } = useOrders({ page, limit: 10 });

  if (sessionStatus === 'loading') {
    return (
      <Container className="flex flex-col gap-gutter py-lg">
        <Skeleton className="h-8 w-40" label="Loading your orders" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </Container>
    );
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <Container className="py-lg">
        <h1 id="main-content" className="text-xl font-semibold text-text">
          Your orders
        </h1>
        <EmptyState
          icon={<UserRound className="size-7" aria-hidden="true" />}
          title="Sign in to see your orders"
          description="Your order history is saved to your account."
          action={
            <ButtonLink href="/login?next=%2Forders" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-lg rounded-lg bg-surface-muted"
        />
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-lg py-lg">
      <h1 id="main-content" className="text-xl font-semibold text-text">
        Your orders
      </h1>

      {isPending ? (
        <div className="flex flex-col gap-gutter">
          <Skeleton className="h-28 w-full" label="Loading your orders" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-7" aria-hidden="true" />}
          title="No orders yet"
          description="When you place your first order it will appear here, with its status and receipt."
          action={
            <ButtonLink href="/categories" variant="primary">
              Start shopping
            </ButtonLink>
          }
          className="rounded-lg bg-surface-muted"
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <ul className="flex flex-col gap-gutter">
            {data.items.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>

          {data.pagination.totalPages > 1 ? (
            <nav
              aria-label="Order history pages"
              className="flex items-center justify-between gap-gutter"
            >
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || isFetching}
              >
                Newer
              </Button>

              <span aria-live="polite" className="text-sm text-text-muted">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>

              <Button
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= data.pagination.totalPages || isFetching}
              >
                Older
              </Button>
            </nav>
          ) : null}
        </>
      ) : null}
    </Container>
  );
}
