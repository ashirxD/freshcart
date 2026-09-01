'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, Phone, UserX } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCustomer, useSetCustomerStatus } from '@/features/admin/admin.hooks';
import { ApiError } from '@/lib/api/errors';
import { formatPkr } from '@/lib/format';
import { AccountPill } from '../customers-screen';

/**
 * ONE CUSTOMER
 *
 * Contact details, account status, and the trading history the account itself
 * does not hold. Deliberately absent: their addresses, their cart, their
 * favourites, and any way to act as them — section 8 rules out impersonation
 * for this milestone, and there is no route on the API that would allow it.
 *
 * Deactivation is the only write. It takes effect on the customer's next
 * request, because the server re-reads the account on every one.
 */
export function AdminCustomerDetailScreen({ id }: { id: string }) {
  const { data: customer, isPending, isError, error, refetch } = useAdminCustomer(id);
  const setStatus = useSetCustomerStatus();

  if (isPending) {
    return (
      <>
        <AdminPageHeader title="Customer" description="Loading…" />
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-32 w-full" label="Loading the customer" />
          <Skeleton className="h-24 w-full" />
        </div>
      </>
    );
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404;

    return missing ? (
      <EmptyState
        icon={<UserX className="size-7" aria-hidden="true" />}
        title="Customer not found"
        description="This account no longer exists, or the link is wrong."
        action={<ButtonLink href="/admin/customers">Back to customers</ButtonLink>}
        className="bg-surface-muted rounded-lg"
      />
    ) : (
      <ErrorState error={error} onRetry={() => void refetch()} />
    );
  }

  return (
    <>
      <Link
        href="/admin/customers"
        className="text-text-muted hover:text-text min-h-touch mb-xs inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        All customers
      </Link>

      <AdminPageHeader
        title={customer.fullName}
        description={
          <span className="gap-xs flex flex-wrap items-center">
            <AccountPill isActive={customer.isActive} />
            <span>·</span>
            <span>
              Joined{' '}
              {new Date(customer.createdAt).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </span>
        }
        actions={
          <Button
            variant={customer.isActive ? 'outline' : 'primary'}
            isLoading={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: customer.id, isActive: !customer.isActive })}
          >
            {customer.isActive ? 'Deactivate account' : 'Reactivate account'}
          </Button>
        }
      />

      <div className="gap-lg grid md:grid-cols-2">
        <section className="border-outline-variant bg-surface p-gutter rounded-lg border">
          <h2 className="text-text mb-gutter text-base font-semibold">Contact</h2>

          <div className="gap-xs flex flex-col">
            <a
              href={'tel:' + customer.phone}
              className="text-primary min-h-touch inline-flex items-center gap-2 text-sm tabular-nums"
            >
              <Phone className="size-4" aria-hidden="true" />
              {customer.phone}
            </a>

            {customer.email ? (
              <a
                href={'mailto:' + customer.email}
                className="text-primary min-h-touch inline-flex items-center gap-2 text-sm"
              >
                <Mail className="size-4" aria-hidden="true" />
                {customer.email}
              </a>
            ) : (
              <p className="text-text-muted text-sm">No email on this account</p>
            )}

            <p className="text-text-muted mt-xs text-sm">
              Last signed in{' '}
              {customer.lastLoginAt
                ? new Date(customer.lastLoginAt).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'never'}
            </p>
          </div>
        </section>

        <section className="border-outline-variant bg-surface p-gutter rounded-lg border">
          <h2 className="text-text mb-gutter text-base font-semibold">Orders</h2>

          <dl className="gap-gutter grid grid-cols-2">
            <div>
              <dt className="text-text-muted text-sm">Orders placed</dt>
              <dd className="text-text text-xl font-bold tabular-nums">{customer.orderCount}</dd>
            </div>

            <div>
              <dt className="text-text-muted text-sm">Total spent</dt>
              <dd className="text-text text-xl font-bold tabular-nums">
                {formatPkr(customer.totalSpent)}
              </dd>
            </div>
          </dl>

          <p className="text-text-muted mt-gutter text-xs">
            Counts orders that were placed and not cancelled, rejected or failed, at the totals
            they were charged.
          </p>

          {customer.lastOrderAt ? (
            <Link
              href={'/admin/orders?customer=' + encodeURIComponent(customer.phone)}
              className="text-primary min-h-touch mt-xs inline-flex items-center text-sm font-medium"
            >
              View their orders
            </Link>
          ) : null}
        </section>
      </div>
    </>
  );
}
