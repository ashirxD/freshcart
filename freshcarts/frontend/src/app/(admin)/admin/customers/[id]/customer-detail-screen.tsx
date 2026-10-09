'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, Phone, UserX } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { EmptyState } from '@/components/common/empty-state';
import { Ltr, Money } from '@/components/common/ltr';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCustomer, useSetCustomerStatus } from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { formatDate } from '@/lib/dates';
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
  const { t, tx, locale } = useI18n();
  const { data: customer, isPending, isError, error, refetch } = useAdminCustomer(id);
  const setStatus = useSetCustomerStatus();

  if (isPending) {
    return (
      <>
        <AdminPageHeader title={t('admin.meta.customer')} description={t('common.loading')} />
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-32 w-full" label={t('admin.customers.loadingLabel')} />
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
        title={t('admin.customers.notFoundTitle')}
        description={t('admin.customers.notFoundBody')}
        action={
          <ButtonLink href="/admin/customers">{t('admin.customers.backToCustomers')}</ButtonLink>
        }
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
        className="text-text-muted hover:text-text min-h-touch mb-tight inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('admin.customers.allCustomers')}
      </Link>

      <AdminPageHeader
        title={<bdi>{customer.fullName}</bdi>}
        description={
          <span className="gap-tight flex flex-wrap items-center">
            <AccountPill isActive={customer.isActive} />
            <span>·</span>
            <span>
              {tx('admin.customers.joined', {
                date: <bdi>{formatDate(customer.createdAt, locale, 'date')}</bdi>,
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
            {customer.isActive ? t('admin.customers.deactivate') : t('admin.customers.reactivate')}
          </Button>
        }
      />

      <div className="gap-loose grid md:grid-cols-2">
        <section className="border-outline-variant bg-surface p-gutter rounded-lg border">
          <h2 className="text-text mb-gutter text-base font-semibold">{t('admin.customers.contact')}</h2>

          <div className="gap-tight flex flex-col">
            <a
              href={'tel:' + customer.phone}
              className="text-primary min-h-touch inline-flex items-center gap-2 text-sm tabular-nums"
            >
              <Phone className="size-4" aria-hidden="true" />
              <Ltr>{customer.phone}</Ltr>
            </a>

            {customer.email ? (
              <a
                href={'mailto:' + customer.email}
                className="text-primary min-h-touch inline-flex items-center gap-2 text-sm"
              >
                <Mail className="size-4" aria-hidden="true" />
                <Ltr>{customer.email}</Ltr>
              </a>
            ) : (
              <p className="text-text-muted text-sm">{t('admin.customers.noEmail')}</p>
            )}

            <p className="text-text-muted mt-tight text-sm">
              {tx('admin.customers.lastSignedIn', {
                when: customer.lastLoginAt ? (
                  <bdi>{formatDate(customer.lastLoginAt, locale, 'date')}</bdi>
                ) : (
                  t('admin.customers.never')
                ),
              })}
            </p>
          </div>
        </section>

        <section className="border-outline-variant bg-surface p-gutter rounded-lg border">
          <h2 className="text-text mb-gutter text-base font-semibold">{t('admin.customers.orders')}</h2>

          <dl className="gap-gutter grid grid-cols-2">
            <div>
              <dt className="text-text-muted text-sm">{t('admin.customers.ordersPlaced')}</dt>
              <dd className="text-text text-xl font-bold tabular-nums">{customer.orderCount}</dd>
            </div>

            <div>
              <dt className="text-text-muted text-sm">{t('admin.customers.totalSpent')}</dt>
              <dd className="text-text text-xl font-bold tabular-nums">
                <Money>{formatPkr(customer.totalSpent)}</Money>
              </dd>
            </div>
          </dl>

          <p className="text-text-muted mt-gutter text-xs">
            {t('admin.customers.ordersNote')}
          </p>

          {customer.lastOrderAt ? (
            <Link
              href={'/admin/orders?customer=' + encodeURIComponent(customer.phone)}
              className="text-primary min-h-touch mt-tight inline-flex items-center text-sm font-medium"
            >
              {t('admin.customers.viewTheirOrders')}
            </Link>
          ) : null}
        </section>
      </div>
    </>
  );
}
