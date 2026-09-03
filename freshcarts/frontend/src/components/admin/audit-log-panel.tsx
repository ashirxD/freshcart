'use client';

import { useState } from 'react';
import { AdminListState, Pagination } from '@/components/admin/admin-page';
import { SelectField } from '@/components/admin/form-field';
import { useAuditLogs } from '@/features/admin/admin.hooks';
import type { AuditAction, AuditEntity, AuditLogEntry } from '@/types/admin';

/**
 * Plain-language wording for each recorded action.
 *
 * The stored value is an enum, so it stays queryable; this is where it becomes
 * a sentence. Section 46 applies to staff screens too — "PRODUCT_STATUS_CHANGED"
 * is a database value, not something to show a person.
 */
const ACTION_LABEL: Record<AuditAction, string> = {
  PRODUCT_CREATED: 'added a product',
  PRODUCT_UPDATED: 'edited a product',
  PRODUCT_STATUS_CHANGED: 'changed whether a product is on sale',
  CATEGORY_CREATED: 'added a category',
  CATEGORY_UPDATED: 'edited a category',
  CATEGORY_STATUS_CHANGED: 'changed whether a category is visible',
  INVENTORY_ADJUSTED: 'changed stock',
  ORDER_STATUS_CHANGED: 'moved an order along',
  ORDER_STATUS_OVERRIDDEN: 'overrode an order status',
  USER_STATUS_CHANGED: 'activated or deactivated an account',
  USER_ROLE_CHANGED: 'changed an account role',
  STORE_MANAGER_CREATED: 'added a store manager',
  STORE_MANAGER_UPDATED: 'edited a store manager',
  STORE_CREATED: 'added a store',
  STORE_UPDATED: 'edited a store',
  DELIVERY_RULE_CREATED: 'added a delivery pricing band',
  DELIVERY_RULE_UPDATED: 'edited a delivery pricing band',
  DELIVERY_RULE_DELETED: 'deleted a delivery pricing band',
  SETTINGS_UPDATED: 'changed platform settings',
};

const ENTITY_FILTERS: Array<{ value: '' | AuditEntity; label: string }> = [
  { value: '', label: 'Everything' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'CATEGORY', label: 'Categories' },
  { value: 'INVENTORY', label: 'Stock' },
  { value: 'ORDER', label: 'Orders' },
  { value: 'USER', label: 'Accounts' },
  { value: 'DELIVERY_RULE', label: 'Delivery pricing' },
  { value: 'SETTINGS', label: 'Settings' },
];

const ROLE_LABEL: Record<AuditLogEntry['actorRole'], string> = {
  ADMIN: 'Administrator',
  STORE_MANAGER: 'Store manager',
  CUSTOMER: 'Customer',
};

/**
 * THE AUDIT TRAIL
 *
 * Who did what, to which resource, when — and nothing else. The API stores
 * scalars only and strips anything resembling a credential before writing, so
 * there is no request body, no address and no token to render here even if this
 * component tried (section 27).
 *
 * It lives on the settings page rather than in its own navigation entry because
 * it is consulted when a question arises, not worked in daily.
 */
export function AuditLogPanel() {
  const [entityType, setEntityType] = useState<'' | AuditEntity>('');
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch } = useAuditLogs({
    page,
    ...(entityType ? { entityType } : {}),
  });

  return (
    <section className="gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1">
      <div className="gap-gutter flex flex-wrap items-end justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-text text-base font-semibold">Activity log</h2>
          <p className="text-text-muted text-sm">
            Administrative changes across the platform, newest first.
          </p>
        </div>

        <SelectField
          label="Show"
          className="max-w-48"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value as '' | AuditEntity);
            setPage(1);
          }}
          options={ENTITY_FILTERS.map((filter) => ({
            value: filter.value,
            label: filter.label,
          }))}
        />
      </div>

      <AdminListState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={data?.items.length === 0}
        skeletonRows={4}
        skeletonClassName="h-12 w-full"
        emptyTitle="Nothing recorded yet"
        emptyDescription="Changes to products, stock, orders, accounts and settings appear here as they happen."
      >
        <ul className="flex flex-col">
          {data?.items.map((entry) => (
            <li
              key={entry.id}
              className="border-outline-variant gap-gutter flex flex-wrap items-baseline justify-between border-b py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-text text-sm">
                  <span className="font-medium">{entry.actorName ?? 'A removed account'}</span>{' '}
                  <span className="text-text-muted">({ROLE_LABEL[entry.actorRole]})</span>{' '}
                  {ACTION_LABEL[entry.action] ?? 'made a change'}
                </p>

                {Object.keys(entry.metadata).length > 0 ? (
                  <p className="text-text-muted text-xs">{describe(entry.metadata)}</p>
                ) : null}
              </div>

              <time
                dateTime={entry.occurredAt}
                className="text-text-muted text-xs whitespace-nowrap tabular-nums"
              >
                {new Date(entry.occurredAt).toLocaleString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
            </li>
          ))}
        </ul>

        <Pagination
          label="Activity log pages"
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          onPageChange={setPage}
        />
      </AdminListState>
    </section>
  );
}

/**
 * Renders the recorded context as a readable line.
 *
 * The metadata is an open map — the server decides what each action records —
 * so this formats generically rather than switching on the action, which would
 * mean a new branch here every time a call site adds a field.
 */
function describe(metadata: Record<string, string | number | boolean>): string {
  return Object.entries(metadata)
    .map(([key, value]) => humanise(key) + ': ' + String(value))
    .join(' · ');
}

function humanise(key: string): string {
  return key
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}
