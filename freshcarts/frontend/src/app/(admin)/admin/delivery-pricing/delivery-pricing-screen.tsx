'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { AdminListState, AdminPageHeader, TableScroller } from '@/components/admin/admin-page';
import { DeliveryRuleDialog } from '@/components/admin/delivery-rule-dialog';
import { Money } from '@/components/common/ltr';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  useAdminSettings,
  useDeleteDeliveryRule,
  useDeliveryRules,
  useUpdateDeliveryRule,
} from '@/features/admin/admin.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { formatPkr } from '@/lib/format';
import type { DeliveryRule } from '@/types/admin';

/** Metres in, kilometres out — an admin thinks in km, the engine works in m. */
function km(meters: number): string {
  return (meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1);
}

/**
 * DELIVERY PRICING
 *
 * This screen configures the pricing engine. It does not price anything: the
 * fee on any given order came from `DeliveryPricingService.priceFor` at the
 * moment that order was placed, and was snapshotted onto it. Editing a band
 * here changes what future orders are charged and leaves every historical
 * order exactly as it was (section 17).
 *
 * Bands are half-open: `[min, max)`. Two adjacent bands may share a bound —
 * 0–2 km and 2–5 km leave no gap and no overlap, and 2000 m belongs to exactly
 * one of them. The screen says so in words, because getting this wrong is the
 * single easiest way to misprice a delivery.
 *
 * Problems with the set as a whole — gaps, overlaps, pricing that stops short
 * of the service radius — are computed server-side and shown above the table,
 * because they are properties of the set rather than of any one row.
 */
export function AdminDeliveryPricingScreen() {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<DeliveryRule | 'new' | null>(null);

  const { data, isPending, isError, error, refetch } = useDeliveryRules();
  const settings = useAdminSettings();
  const updateRule = useUpdateDeliveryRule();
  const deleteRule = useDeleteDeliveryRule();

  const radius = settings.data?.maxDeliveryDistanceMeters;

  return (
    <>
      <AdminPageHeader
        title={t('admin.delivery.title')}
        description={
          radius
            ? t('admin.delivery.upTo', { km: km(radius) })
            : t('admin.delivery.usedToPrice')
        }
        actions={
          <Button
            variant="primary"
            onClick={() => setEditing('new')}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('admin.delivery.addBand')}
          </Button>
        }
      />

      {data && data.problems.length > 0 ? (
        <div
          role="alert"
          className="border-secondary/40 bg-secondary-container/20 p-gutter mb-loose rounded-lg border"
        >
          <p className="text-secondary mb-tight flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('admin.delivery.problemsTitle')}
          </p>

          <ul className="text-secondary flex list-inside list-disc flex-col gap-0.5 text-sm">
            {data.problems.map((problem, index) => (
              <li key={index}>
                {locale === 'en' ? problem.message : t(('admin.delivery.problem' + problem.kind) as TranslationKey)}
              </li>
            ))}
          </ul>

          <p className="text-text-muted mt-tight text-xs">
            {t('admin.delivery.problemNote')}
          </p>
        </div>
      ) : null}

      <AdminListState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={data?.rules.length === 0}
        emptyTitle={t('admin.delivery.emptyTitle')}
        emptyDescription={t('admin.delivery.emptyBody')}
        emptyAction={
          <Button variant="primary" onClick={() => setEditing('new')}>
            {t('admin.delivery.addFirst')}
          </Button>
        }
      >
        <TableScroller>
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">
              {t('admin.delivery.caption')}
            </caption>

            <thead className="border-outline-variant text-text-muted border-b text-start">
              <tr>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.delivery.colBand')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.delivery.colDistance')}
                </th>
                <th scope="col" className="p-gutter text-end font-semibold">
                  {t('admin.delivery.colFee')}
                </th>
                <th scope="col" className="p-gutter font-semibold">
                  {t('admin.delivery.colStatus')}
                </th>
                <th scope="col" className="p-gutter text-end font-semibold">
                  <span className="sr-only">{t('common.actions')}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {data?.rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-outline-variant hover:bg-surface-muted border-b last:border-0"
                >
                  <td className="p-gutter text-text font-medium">
                    <bdi>{rule.label}</bdi>
                  </td>

                  <td className="p-gutter text-text-muted tabular-nums">
                    {t('admin.delivery.range', {
                      from: km(rule.minDistanceMeters),
                      to: km(rule.maxDistanceMeters),
                    })}
                    <span className="block text-xs">
                      {t('admin.delivery.includes', {
                        from: km(rule.minDistanceMeters),
                        to: km(rule.maxDistanceMeters),
                      })}
                    </span>
                  </td>

                  <td className="p-gutter text-text text-end font-semibold tabular-nums">
                    <Money>{formatPkr(rule.fee)}</Money>
                  </td>

                  <td className="p-gutter">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        rule.isActive
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-sunken text-text-muted',
                      )}
                    >
                      {rule.isActive ? t('admin.delivery.inUse') : t('admin.delivery.off')}
                    </span>
                  </td>

                  <td className="p-gutter">
                    <div className="gap-tight flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(rule)}>
                        {t('common.edit')}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={updateRule.isPending}
                        onClick={() => updateRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                      >
                        {rule.isActive ? t('admin.delivery.turnOff') : t('admin.delivery.turnOn')}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={deleteRule.isPending}
                        onClick={() => deleteRule.mutate(rule.id)}
                        // The server refuses to delete the last active band, so
                        // there is no way to leave the store unable to price.
                        aria-label={t('admin.delivery.deleteAria', { label: rule.label })}
                        leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                      >
                        <span className="sr-only">{t('admin.products.delete')}</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      </AdminListState>

      <DeliveryRuleDialog
        rule={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
