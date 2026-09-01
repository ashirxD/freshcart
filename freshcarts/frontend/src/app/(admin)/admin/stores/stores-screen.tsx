'use client';

import { useState } from 'react';
import { MapPin, Plus, Store } from 'lucide-react';
import { AdminListState, AdminPageHeader } from '@/components/admin/admin-page';
import { StoreDialog } from '@/components/admin/store-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useAdminStores } from '@/features/admin/admin.hooks';
import type { AdminStore } from '@/types/admin';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * STORES
 *
 * Cards rather than a table: a store has an address, a phone number and a week
 * of opening hours, none of which fit a row without being truncated into
 * uselessness. There are a handful of stores, so the whole list is one request
 * with no pagination — and the API caps it, so this stays true if that changes.
 *
 * The write path is the existing ADMIN-guarded `/stores` endpoints, not a
 * parallel admin copy of StoreService (section 11).
 */
export function AdminStoresScreen() {
  const [editing, setEditing] = useState<AdminStore | 'new' | null>(null);
  const { data, isPending, isError, error, refetch } = useAdminStores();

  return (
    <>
      <AdminPageHeader
        title="Stores"
        description={data ? data.length + ' stores' : 'Where FreshCarts trades from'}
        actions={
          <Button
            variant="primary"
            onClick={() => setEditing('new')}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            Add store
          </Button>
        }
      />

      <AdminListState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={data?.length === 0}
        skeletonClassName="h-44 w-full"
        skeletonRows={2}
        emptyTitle="No stores yet"
        emptyDescription="A store is the scope everything else hangs off: its catalogue, its stock, its orders."
        emptyAction={
          <Button variant="primary" onClick={() => setEditing('new')}>
            Add the first store
          </Button>
        }
      >
        <ul className="gap-gutter grid md:grid-cols-2">
          {data?.map((store) => (
            <li
              key={store.id}
              className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-col rounded-lg border"
            >
              <div className="gap-gutter flex items-start justify-between">
                <div className="min-w-0">
                  <h2 className="text-text gap-2 flex items-center text-base font-semibold">
                    <Store className="size-4 shrink-0" aria-hidden="true" />
                    {store.name}
                  </h2>
                  <p className="text-text-muted text-sm">{store.slug}</p>
                </div>

                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                    store.isActive
                      ? 'bg-success/10 text-success'
                      : 'bg-surface-sunken text-text-muted',
                  )}
                >
                  {store.isActive ? 'Trading' : 'Closed'}
                </span>
              </div>

              <p className="text-text-muted gap-2 flex items-start text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {store.address.line1}, {store.address.area}, {store.address.city}
                </span>
              </p>

              <p className="text-text-muted text-sm tabular-nums">{store.phone}</p>

              <OpeningHoursSummary store={store} />

              <div className="mt-auto flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(store)}>
                  Edit store
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AdminListState>

      <StoreDialog
        store={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/**
 * A week of hours, compressed.
 *
 * Seven identical rows is noise; "Every day 08:00–23:00" is the same fact a
 * person can read at a glance. Days without an entry are shown as unset rather
 * than closed — the server treats a missing day as open, and the summary must
 * not claim otherwise.
 */
function OpeningHoursSummary({ store }: { store: AdminStore }) {
  const hours = store.openingHours ?? [];

  if (hours.length === 0) {
    return <p className="text-text-muted text-sm">Open whenever the store is active</p>;
  }

  const open = hours.filter((window) => !window.isClosed);
  const uniform =
    open.length === 7 &&
    open.every(
      (window) => window.opensAt === open[0].opensAt && window.closesAt === open[0].closesAt,
    );

  if (uniform) {
    return (
      <p className="text-text-muted text-sm tabular-nums">
        Every day {open[0].opensAt}–{open[0].closesAt}
      </p>
    );
  }

  return (
    <ul className="text-text-muted gap-0.5 flex flex-col text-sm">
      {[...hours]
        .sort((a, b) => a.day - b.day)
        .map((window) => (
          <li key={window.day} className="flex justify-between tabular-nums">
            <span>{DAY_NAMES[window.day]}</span>
            <span>{window.isClosed ? 'Closed' : window.opensAt + '–' + window.closesAt}</span>
          </li>
        ))}
    </ul>
  );
}
