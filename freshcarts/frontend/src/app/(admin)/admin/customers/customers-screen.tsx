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
import { cn } from '@/lib/cn';
import { useAdminCustomers } from '@/features/admin/admin.hooks';
import type { AdminCustomerSummary } from '@/types/admin';

const ACCOUNT_FILTERS = [
  { value: '' as const, label: 'All' },
  { value: 'active' as const, label: 'Active' },
  { value: 'inactive' as const, label: 'Deactivated' },
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
        title="Customers"
        description={data ? data.pagination.total + ' accounts' : 'Everyone who has registered'}
      />

      <div className="gap-gutter mb-gutter flex flex-wrap items-center">
        <SearchBar
          label="Search customers"
          placeholder="Name, phone or email"
          className="min-w-64 flex-1"
          onSearch={(term) => {
            setSearch(term);
            setPage(1);
          }}
        />

        <FilterChips
          label="Filter by account status"
          options={ACCOUNT_FILTERS}
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
        emptyTitle="No customers match this search"
        emptyDescription={
          search || account
            ? 'Try a different name, phone number or status.'
            : 'Customers appear here as soon as they register.'
        }
      >
        <TableScroller>
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">
              Registered customers, newest first. Each row links to that customer.
            </caption>

            <thead className="border-outline-variant text-text-muted border-b text-left">
              <tr>
                <th scope="col" className="p-gutter font-semibold">Name</th>
                <th scope="col" className="p-gutter font-semibold">Phone</th>
                <th scope="col" className="p-gutter font-semibold">Email</th>
                <th scope="col" className="p-gutter font-semibold">Account</th>
                <th scope="col" className="p-gutter font-semibold">Joined</th>
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
          label="Customer pages"
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          onPageChange={setPage}
        />
      </AdminListState>
    </>
  );
}

function CustomerRow({ customer }: { customer: AdminCustomerSummary }) {
  return (
    <tr className="border-outline-variant hover:bg-surface-muted border-b last:border-0">
      <td className="p-gutter">
        <Link
          href={'/admin/customers/' + customer.id}
          className="text-primary font-medium underline-offset-2 hover:underline"
        >
          {customer.fullName}
        </Link>
      </td>

      <td className="p-gutter text-text tabular-nums">{customer.phone}</td>

      <td className="p-gutter text-text-muted">{customer.email ?? '—'}</td>

      <td className="p-gutter">
        <AccountPill isActive={customer.isActive} />
      </td>

      <td className="p-gutter text-text-muted whitespace-nowrap">
        {new Date(customer.createdAt).toLocaleDateString('en-PK', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
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
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        isActive ? 'bg-success/10 text-success' : 'bg-surface-sunken text-text-muted',
      )}
    >
      {isActive ? 'Active' : 'Deactivated'}
    </span>
  );
}
