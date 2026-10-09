'use client';

import { useState } from 'react';
import { AdminListState, Pagination } from '@/components/admin/admin-page';
import { SelectField } from '@/components/admin/form-field';
import { useAuditLogs } from '@/features/admin/admin.hooks';
import { useI18n, translateIfKnown, type TranslationKey } from '@/i18n';
import { formatDate } from '@/lib/dates';
import type { AuditEntity } from '@/types/admin';

/**
 * Plain-language wording for each recorded action — `admin.audit.action.<ENUM>`.
 *
 * The stored value is an enum, so it stays queryable; the dictionary is where it
 * becomes a sentence. Section 46 applies to staff screens too —
 * "PRODUCT_STATUS_CHANGED" is a database value, not something to show a person.
 * An action this build has no wording for reads as "made a change".
 */
const ENTITY_FILTERS: Array<{ value: '' | AuditEntity; labelKey: TranslationKey }> = [
  { value: '', labelKey: 'admin.audit.everything' },
  { value: 'PRODUCT', labelKey: 'admin.audit.entityPRODUCT' },
  { value: 'CATEGORY', labelKey: 'admin.audit.entityCATEGORY' },
  { value: 'INVENTORY', labelKey: 'admin.audit.entityINVENTORY' },
  { value: 'ORDER', labelKey: 'admin.audit.entityORDER' },
  { value: 'USER', labelKey: 'admin.audit.entityUSER' },
  { value: 'DELIVERY_RULE', labelKey: 'admin.audit.entityDELIVERY_RULE' },
  { value: 'SETTINGS', labelKey: 'admin.audit.entitySETTINGS' },
];

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
  const { t, locale } = useI18n();
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
          <h2 className="text-text text-base font-semibold">{t('admin.audit.title')}</h2>
          <p className="text-text-muted text-sm">{t('admin.audit.description')}</p>
        </div>

        <SelectField
          label={t('admin.audit.show')}
          className="max-w-48"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value as '' | AuditEntity);
            setPage(1);
          }}
          options={ENTITY_FILTERS.map((filter) => ({
            value: filter.value,
            label: t(filter.labelKey),
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
        emptyTitle={t('admin.audit.emptyTitle')}
        emptyDescription={t('admin.audit.emptyBody')}
      >
        <ul className="flex flex-col">
          {data?.items.map((entry) => (
            <li
              key={entry.id}
              className="border-outline-variant gap-gutter flex flex-wrap items-baseline justify-between border-b py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-text text-sm">
                  <span className="font-medium">
                    {entry.actorName ? <bdi>{entry.actorName}</bdi> : t('admin.audit.removedAccount')}
                  </span>{' '}
                  <span className="text-text-muted">
                    (
                    {translateIfKnown(locale, 'admin.audit.rolePanel' + entry.actorRole) ??
                      entry.actorRole}
                    )
                  </span>{' '}
                  {translateIfKnown(locale, 'admin.audit.action.' + entry.action) ??
                    t('admin.audit.madeChange')}
                </p>

                {Object.keys(entry.metadata).length > 0 ? (
                  <p className="text-text-muted text-xs">{describe(entry.metadata)}</p>
                ) : null}
              </div>

              <time
                dateTime={entry.occurredAt}
                className="text-text-muted text-xs whitespace-nowrap tabular-nums"
              >
                <bdi>{formatDate(entry.occurredAt, locale, 'moment')}</bdi>
              </time>
            </li>
          ))}
        </ul>

        <Pagination
          label={t('admin.audit.pagesLabel')}
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
