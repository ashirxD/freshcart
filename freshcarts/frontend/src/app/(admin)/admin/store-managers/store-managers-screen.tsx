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
import { Ltr } from '@/components/common/ltr';
import { Button } from '@/components/ui/button';
import {
  useAdminStoreManagers,
  useAdminStores,
  useSetStoreManagerStatus,
} from '@/features/admin/admin.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { AccountPill } from '../customers/customers-screen';
import type { AdminStoreManager } from '@/types/admin';

const ACCOUNT_FILTERS = [
  { value: '' as const, labelKey: 'common.all' as TranslationKey },
  { value: 'active' as const, labelKey: 'admin.pill.active' as TranslationKey },
  { value: 'inactive' as const, labelKey: 'admin.pill.deactivated' as TranslationKey },
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
  const { t } = useI18n();
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
        title={t('admin.managers.title')}
        description={
          data
            ? t('admin.managers.staff', { count: data.pagination.total })
            : t('admin.managers.whoRuns')
        }
        actions={
          <Button
            variant="primary"
            onClick={() => setEditing('new')}
            leadingIcon={<UserPlus className="size-4" aria-hidden="true" />}
          >
            {t('admin.managers.add')}
          </Button>
        }
      />

      <div className="gap-gutter mb-gutter flex flex-wrap items-center">
        <SearchBar
          label={t('admin.managers.searchLabel')}
          placeholder={t('admin.managers.searchPlaceholder')}
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
        emptyTitle={t('admin.managers.emptyTitle')}
        emptyDescription={t('admin.managers.emptyBody')}
        emptyAction={
          <Button variant="primary" onClick={() => setEditing('new')}>
            {t('admin.managers.addFirst')}
          </Button>
        }
      >
        <TableScroller>
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">
              {t('admin.managers.caption')}
            </caption>

            <thead className="border-outline-variant text-text-muted border-b text-start">
              <tr>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.managers.colName')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.managers.colPhone')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.managers.colStore')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.managers.colAccount')}
                </th>
                <th scope="col" className="p-gutter text-end font-semibold">
                  <span className="sr-only">{t('common.actions')}</span>
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
                    <span className="text-text font-medium">
                      <bdi>{manager.fullName}</bdi>
                    </span>
                    {manager.email ? (
                      <span className="text-text-muted block text-xs">
                        <Ltr>{manager.email}</Ltr>
                      </span>
                    ) : null}
                  </td>

                  <td className="p-gutter text-text tabular-nums">
                    <Ltr>{manager.phone}</Ltr>
                  </td>

                  <td className="p-gutter text-text-muted">
                    {manager.store ? (
                      <bdi>{manager.store.name}</bdi>
                    ) : (
                      // A manager with no store cannot open any store screen —
                      // the server fails closed rather than defaulting.
                      <span className="text-danger font-medium">{t('admin.managers.noStore')}</span>
                    )}
                  </td>

                  <td className="p-gutter">
                    <AccountPill isActive={manager.isActive} />
                  </td>

                  <td className="p-gutter">
                    <div className="gap-tight flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(manager)}>
                        {t('common.edit')}
                      </Button>

                      <Button
                        variant={manager.isActive ? 'outline' : 'primary'}
                        size="sm"
                        isLoading={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({ id: manager.id, isActive: !manager.isActive })
                        }
                      >
                        {manager.isActive
                          ? t('admin.managers.deactivate')
                          : t('admin.managers.reactivate')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>

        <Pagination
          label={t('admin.managers.pagesLabel')}
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
