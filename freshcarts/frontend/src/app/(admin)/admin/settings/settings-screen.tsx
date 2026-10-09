'use client';

import { useEffect, useState } from 'react';
import { Info, PauseCircle, PlayCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { AuditLogPanel } from '@/components/admin/audit-log-panel';
import { CheckboxField, FormSection } from '@/components/admin/form-field';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminSettings, useUpdateSettings } from '@/features/admin/admin.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { isValidPkMobile, normalisePkPhone } from '@/lib/phone';
import type { PlatformSettings } from '@/types/admin';

interface FormState {
  maxDeliveryKm: string;
  defaultLowStockThreshold: string;
  orderingEnabled: boolean;
  supportPhone: string;
  supportEmail: string;
}

/**
 * PLATFORM SETTINGS
 *
 * The business decisions an operator makes, kept apart from the deployment
 * facts a deployer makes (section 25). Everything in the first two cards is
 * stored in the database and takes effect on the next request; everything in
 * the last card is environment configuration, shown read-only so an admin is
 * not left hunting for a switch that does not exist.
 *
 * Every setting here is read by real code. Nothing is stored speculatively — a
 * toggle nobody consults is a lie about how the system behaves.
 */
export function AdminSettingsScreen() {
  const { t } = useI18n();
  const { data, isPending, isError, error, refetch } = useAdminSettings();

  if (isPending) {
    return (
      <>
        <AdminPageHeader title={t('admin.settings.title')} description={t('common.loading')} />
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-48 w-full" label={t('admin.settings.loadingLabel')} />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <AdminPageHeader title={t('admin.settings.title')} />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </>
    );
  }

  return <SettingsForm settings={data} />;
}

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<FormState>(() => toForm(settings));
  const [showErrors, setShowErrors] = useState(false);

  const save = useUpdateSettings();

  // Re-seed after a save so the form shows what the server actually stored,
  // rather than what was typed — they differ if the server normalised anything.
  useEffect(() => {
    setForm(toForm(settings));
  }, [settings]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const maxKm = Number(form.maxDeliveryKm);
  const threshold = Number(form.defaultLowStockThreshold);

  const errors = {
    maxDeliveryKm:
      Number.isFinite(maxKm) && maxKm >= 0.5 && maxKm <= 100
        ? undefined
        : t('admin.settings.errMaxKm'),
    defaultLowStockThreshold:
      Number.isInteger(threshold) && threshold >= 0 && threshold <= 10_000
        ? undefined
        : t('admin.settings.errThreshold'),
    supportPhone: isValidPkMobile(form.supportPhone)
      ? undefined
      : t('admin.settings.errPhone'),
    supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())
      ? undefined
      : t('admin.settings.errEmail'),
  };

  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    save.mutate({
      maxDeliveryDistanceMeters: Math.round(maxKm * 1000),
      defaultLowStockThreshold: threshold,
      orderingEnabled: form.orderingEnabled,
      supportPhone: normalisePkPhone(form.supportPhone),
      supportEmail: form.supportEmail.trim().toLowerCase(),
    });
  };

  return (
    <>
      <AdminPageHeader
        title={t('admin.settings.title')}
        description={
          settings.updatedAt
            ? t('admin.settings.lastChanged', { date: formatDate(settings.updatedAt, locale, 'date') })
            : t('admin.settings.howTrades')
        }
        actions={
          <Button variant="primary" onClick={submit} isLoading={save.isPending}>
            {t('admin.settings.save')}
          </Button>
        }
      />

      <div className="gap-loose flex flex-col">
        <FormSection
          title={t('admin.settings.tradingTitle')}
          description={t('admin.settings.tradingDesc')}
        >
          <div
            className={
              'gap-gutter p-gutter flex items-start rounded-lg border ' +
              (form.orderingEnabled
                ? 'border-outline-variant bg-surface-muted'
                : 'border-secondary/40 bg-secondary-container/20')
            }
          >
            {form.orderingEnabled ? (
              <PlayCircle className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : (
              <PauseCircle className="text-secondary mt-0.5 size-5 shrink-0" aria-hidden="true" />
            )}

            <CheckboxField
              label={t('admin.settings.accepting')}
              hint={t('admin.settings.acceptingHint')}
              checked={form.orderingEnabled}
              onChange={(checked) => set('orderingEnabled', checked)}
            />
          </div>

          <Input
            label={t('admin.settings.maxDistance')}
            type="number"
            inputMode="decimal"
            min={0.5}
            max={100}
            step="0.5"
            value={form.maxDeliveryKm}
            onChange={(event) => set('maxDeliveryKm', event.target.value)}
            error={showErrors ? errors.maxDeliveryKm : undefined}
            hint={t('admin.settings.maxDistanceHint')}
          />
        </FormSection>

        <FormSection
          title={t('admin.settings.stockSupportTitle')}
          description={t('admin.settings.stockSupportDesc')}
        >
          <Input
            label={t('admin.settings.threshold')}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.defaultLowStockThreshold}
            onChange={(event) => set('defaultLowStockThreshold', event.target.value)}
            error={showErrors ? errors.defaultLowStockThreshold : undefined}
            hint={t('admin.settings.thresholdHint')}
          />

          <Input
            label={t('admin.settings.supportPhone')}
            type="tel"
            inputMode="tel"
            value={form.supportPhone}
            onChange={(event) => set('supportPhone', event.target.value)}
            error={showErrors ? errors.supportPhone : undefined}
            hint={t('admin.settings.supportPhoneHint')}
          />

          <Input
            label={t('admin.settings.supportEmail')}
            type="email"
            value={form.supportEmail}
            onChange={(event) => set('supportEmail', event.target.value)}
            error={showErrors ? errors.supportEmail : undefined}
          />
        </FormSection>

        <FormSection
          title={t('admin.settings.deploymentTitle')}
          description={t('admin.settings.deploymentDesc')}
        >
          <dl className="gap-gutter grid sm:grid-cols-3">
            <ReadOnlyFact
              label={t('admin.settings.paymentMethods')}
              value={settings.environment.paymentMethods
                .map((method) => t(('checkout.payment.method.' + method) as TranslationKey))
                .join(locale === 'en' ? ', ' : '، ')}
            />

            <ReadOnlyFact
              label={t('admin.settings.distanceProvider')}
              value={
                settings.environment.routingProvider === 'osrm'
                  ? t('admin.settings.providerOsrm')
                  : t('admin.settings.providerEstimate')
              }
            />

            <ReadOnlyFact
              label={t('admin.settings.scanning')}
              value={
                settings.environment.aiServiceEnabled
                  ? t('admin.settings.enabled')
                  : t('admin.settings.disabled')
              }
            />
          </dl>

          {settings.environment.routingProvider !== 'osrm' ? (
            <p className="text-text-muted flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('admin.settings.estimateNote')}
            </p>
          ) : null}
        </FormSection>

        <AuditLogPanel />
      </div>
    </>
  );
}

function ReadOnlyFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted text-sm">{label}</dt>
      <dd className="text-text text-sm font-medium">{value}</dd>
    </div>
  );
}

function toForm(settings: PlatformSettings): FormState {
  return {
    maxDeliveryKm: String(settings.maxDeliveryDistanceMeters / 1000),
    defaultLowStockThreshold: String(settings.defaultLowStockThreshold),
    orderingEnabled: settings.orderingEnabled,
    supportPhone: settings.supportPhone,
    supportEmail: settings.supportEmail,
  };
}
