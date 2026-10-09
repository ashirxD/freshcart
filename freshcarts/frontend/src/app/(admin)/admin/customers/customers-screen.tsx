'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AdminListState,
  AdminPageHeader,
  FilterChips,
  Pagination,
  TableScroller,
} from '@/components/admin/admin-page';
import { SearchBar } from '@/components/common/search-bar';
import { Ltr } from '@/components/common/ltr';
import { useI18n, useT, type TranslationKey } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { useAdminCustomers } from '@/features/admin/admin.hooks';
import type { AdminCustomerSummary } from '@/types/admin';

const ACCOUNT_FILTERS = [
  { value: '' as const, labelKey: 'common.all' as TranslationKey },
  { value: 'active' as const, labelKey: 'admin.pill.active' as TranslationKey },
  { value: 'inactive' as const, labelKey: 'admin.pill.deactivated' as TranslationKey },
] as const;

type AccountFilter = (typeof ACCOUNT_FILTERS)[number]['value'];

/**
 * THE CUSTOMER LIST
 *
 * Name, phone, email, status, joined. That is the whole projection, and the
 * API sends nothing more — no password hash, no token, no addresses, no order
 * contents (section 7). What an admin needs beyond this is on the detail
 * screen, where a specific question is being answered about one person.
 *
 * Search and filtering are server-side and paginated: a customer table is the
 * one an admin is most tempted to load whole, and it is also the one that grows
 * fastest.
 */
export function AdminCustomersScreen() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState<AccountFilter>('');
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch } = useAdminCustomers({
    page,
    ...(search ? { search } : {}),
    ...(account ? { isActive: account === 'active' } : {}),
  });

  return (
    <>
      <AdminPageHeader
        title={t('admin.customers.title')}
        description={
          data
            ? t('admin.customers.accounts', { count: data.pagination.total })
            : t('admin.customers.everyone')
        }
      />

      <div className="gap-gutter mb-gutter flex flex-wrap items-center">
        <SearchBar
          label={t('admin.customers.searchLabel')}
          placeholder={t('admin.customers.searchPlaceholder')}
          className="min-w-64 flex-1"
          onSearch={(term) => {
            setSearch(term);
            setPage(1);
          }}
        />

        <FilterChips
          label={t('admin.customers.filterLabel')}
          options={ACCOUNT_FILTERS.map((filter) => ({
            value: filter.value,
            label: t(filter.labelKey),
          }))}
          value={account}
          onChange={(next) => {
            setAccount(next);
            setPage(1);
          }}
        />
      </div>

      <AdminListState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={data?.items.length === 0}
        emptyTitle={t('admin.customers.emptyTitle')}
        emptyDescription={
          search || account
            ? t('admin.customers.emptyFiltered')
            : t('admin.customers.emptyNone')
        }
      >
        <TableScroller>
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">
              {t('admin.customers.caption')}
            </caption>

            <thead className="border-outline-variant text-text-muted border-b text-start">
              <tr>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.customers.colName')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.customers.colPhone')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.customers.colEmail')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.customers.colAccount')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.customers.colJoined')}
                </th>
              </tr>
            </thead>

            <tbody>
              {data?.items.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
              ))}
            </tbody>
          </table>
        </TableScroller>

        <Pagination
          label={t('admin.customers.pagesLabel')}
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          onPageChange={setPage}
        />
      </AdminListState>
    </>
  );
}

function CustomerRow({ customer }: { customer: AdminCustomerSummary }) {
  const { locale } = useI18n();

  return (
    <tr className="border-outline-variant hover:bg-surface-muted border-b last:border-0">
      <td className="p-gutter">
        <Link
          href={'/admin/customers/' + customer.id}
          className="text-primary font-medium underline-offset-2 hover:underline"
        >
          <bdi>{customer.fullName}</bdi>
        </Link>
      </td>

      <td className="p-gutter text-text tabular-nums">
        <Ltr>{customer.phone}</Ltr>
      </td>

      <td className="p-gutter text-text-muted">
        {customer.email ? <Ltr>{customer.email}</Ltr> : '—'}
      </td>

      <td className="p-gutter">
        <AccountPill isActive={customer.isActive} />
      </td>

      <td className="p-gutter text-text-muted whitespace-nowrap">
        {formatDate(customer.createdAt, locale, 'date')}
      </td>
    </tr>
  );
}

/**
 * "Active" / "Deactivated" rather than a green or grey dot.
 *
 * The word carries the meaning; the colour only reinforces it (section 44).
 */
export function AccountPill({ isActive }: { isActive: boolean }) {
  const t = useT();

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        isActive ? 'bg-success/10 text-success' : 'bg-surface-sunken text-text-muted',
      )}
    >
      {isActive ? t('admin.pill.active') : t('admin.pill.deactivated')}
    </span>
  );
}
