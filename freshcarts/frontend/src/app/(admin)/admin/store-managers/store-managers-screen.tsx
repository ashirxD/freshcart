'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import {
  AdminListState,
  AdminPageHeader,
  FilterChips,
  Pagination,
  TableScroller,
} from '@/components/admin/admin-page';
import { StoreManagerDialog } from '@/components/admin/store-manager-dialog';
import { SearchBar } from '@/components/common/search-bar';
import { Button } from '@/components/ui/button';
import {
  useAdminStoreManagers,
  useAdminStores,
  useSetStoreManagerStatus,
} from '@/features/admin/admin.hooks';
import { AccountPill } from '../customers/customers-screen';
import type { AdminStoreManager } from '@/types/admin';

const ACCOUNT_FILTERS = [
  { value: '' as const, label: 'All' },
  { value: 'active' as const, label: 'Active' },
  { value: 'inactive' as const, label: 'Deactivated' },
] as const;

type AccountFilter = (typeof ACCOUNT_FILTERS)[number]['value'];

/**
 * STAFF ACCOUNTS
 *
 * Only an admin reaches this screen, and only an admin can change a store
 * assignment — a store manager has no route to their own role or store, by
 * design (section 9, section 30).
 *
 * Deactivation rather than deletion: a manager who confirmed orders is named in
 * their status history, and removing the account would orphan that record.
 */
export function AdminStoreManagersScreen() {
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState<AccountFilter>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminStoreManager | 'new' | null>(null);

  const stores = useAdminStores();
  const setStatus = useSetStoreManagerStatus();

  const { data, isPending, isError, error, refetch } = useAdminStoreManagers({
    page,
    ...(search ? { search } : {}),
    ...(account ? { isActive: account === 'active' } : {}),
  });

  return (
    <>
      <AdminPageHeader
        title="Store managers"
        description={
          data ? data.pagination.total + ' staff accounts' : 'Who runs each store day to day'
        }
        actions={
          <Button
            variant="primary"
            onClick={() => setEditing('new')}
            leadingIcon={<UserPlus className="size-4" aria-hidden="true" />}
          >
            Add manager
          </Button>
        }
      />

      <div className="gap-gutter mb-gutter flex flex-wrap items-center">
        <SearchBar
          label="Search store managers"
          placeholder="Name or phone"
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
        emptyTitle="No store managers yet"
        emptyDescription="A store manager runs one store: its order queue, its stock and what it has available."
        emptyAction={
          <Button variant="primary" onClick={() => setEditing('new')}>
            Add the first manager
          </Button>
        }
      >
        <TableScroller>
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Store manager accounts and the store each one runs.</caption>

            <thead className="border-outline-variant text-text-muted border-b text-left">
              <tr>
                <th scope="col" className="p-gutter font-semibold">Name</th>
                <th scope="col" className="p-gutter font-semibold">Phone</th>
                <th scope="col" className="p-gutter font-semibold">Store</th>
                <th scope="col" className="p-gutter font-semibold">Account</th>
                <th scope="col" className="p-gutter text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {data?.items.map((manager) => (
                <tr
                  key={manager.id}
                  className="border-outline-variant hover:bg-surface-muted border-b last:border-0"
                >
                  <td className="p-gutter">
                    <span className="text-text font-medium">{manager.fullName}</span>
                    {manager.email ? (
                      <span className="text-text-muted block text-xs">{manager.email}</span>
                    ) : null}
                  </td>

                  <td className="p-gutter text-text tabular-nums">{manager.phone}</td>

                  <td className="p-gutter text-text-muted">
                    {manager.store ? (
                      manager.store.name
                    ) : (
                      // A manager with no store cannot open any store screen —
                      // the server fails closed rather than defaulting.
                      <span className="text-danger font-medium">No store assigned</span>
                    )}
                  </td>

                  <td className="p-gutter">
                    <AccountPill isActive={manager.isActive} />
                  </td>

                  <td className="p-gutter">
                    <div className="gap-xs flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(manager)}>
                        Edit
                      </Button>

                      <Button
                        variant={manager.isActive ? 'outline' : 'primary'}
                        size="sm"
                        isLoading={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({ id: manager.id, isActive: !manager.isActive })
                        }
                      >
                        {manager.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>

        <Pagination
          label="Store manager pages"
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          onPageChange={setPage}
        />
      </AdminListState>

      <StoreManagerDialog
        manager={editing === 'new' ? null : editing}
        open={editing !== null}
        stores={stores.data ?? []}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
