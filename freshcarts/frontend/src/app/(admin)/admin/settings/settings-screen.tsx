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
  const { data, isPending, isError, error, refetch } = useAdminSettings();

  if (isPending) {
    return (
      <>
        <AdminPageHeader title="Settings" description="Loading…" />
        <div className="gap-gutter flex flex-col">
          <Skeleton className="h-48 w-full" label="Loading settings" />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <AdminPageHeader title="Settings" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </>
    );
  }

  return <SettingsForm settings={data} />;
}

function SettingsForm({ settings }: { settings: PlatformSettings }) {
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
        : 'Enter a radius between 0.5 km and 100 km',
    defaultLowStockThreshold:
      Number.isInteger(threshold) && threshold >= 0 && threshold <= 10_000
        ? undefined
        : 'Enter a whole number of units',
    supportPhone: isValidPkMobile(form.supportPhone)
      ? undefined
      : 'Enter a valid Pakistani mobile number',
    supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())
      ? undefined
      : 'Enter a valid email address',
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
        title="Settings"
        description={
          settings.updatedAt
            ? 'Last changed ' +
              new Date(settings.updatedAt).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : 'How FreshCarts trades'
        }
        actions={
          <Button variant="primary" onClick={submit} isLoading={save.isPending}>
            Save changes
          </Button>
        }
      />

      <div className="gap-lg flex flex-col">
        <FormSection
          title="Trading"
          description="Whether FreshCarts is taking orders at all, and how far it will deliver."
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
              label="Accepting orders"
              hint="Turning this off stops every new order across the platform, whatever a store's opening hours say. Orders already placed are unaffected."
              checked={form.orderingEnabled}
              onChange={(checked) => set('orderingEnabled', checked)}
            />
          </div>

          <Input
            label="Maximum delivery distance (km)"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={100}
            step="0.5"
            value={form.maxDeliveryKm}
            onChange={(event) => set('maxDeliveryKm', event.target.value)}
            error={showErrors ? errors.maxDeliveryKm : undefined}
            hint="Beyond this, delivery is refused and the shopper is offered pickup. Orders already placed keep the distance and fee they were charged."
          />
        </FormSection>

        <FormSection
          title="Stock and support"
          description="Defaults for new products, and how shoppers reach you when something goes wrong."
        >
          <Input
            label="Default low-stock threshold"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.defaultLowStockThreshold}
            onChange={(event) => set('defaultLowStockThreshold', event.target.value)}
            error={showErrors ? errors.defaultLowStockThreshold : undefined}
            hint="Applied to new products only. Products already in the catalogue keep the threshold they have."
          />

          <Input
            label="Support phone"
            type="tel"
            inputMode="tel"
            value={form.supportPhone}
            onChange={(event) => set('supportPhone', event.target.value)}
            error={showErrors ? errors.supportPhone : undefined}
            hint="Shown to shoppers on error and order screens. Never a personal number."
          />

          <Input
            label="Support email"
            type="email"
            value={form.supportEmail}
            onChange={(event) => set('supportEmail', event.target.value)}
            error={showErrors ? errors.supportEmail : undefined}
          />
        </FormSection>

        <FormSection
          title="Deployment"
          description="Set by the environment this API runs in. Changing any of these needs a redeploy, not a form."
        >
          <dl className="gap-gutter grid sm:grid-cols-3">
            <ReadOnlyFact
              label="Payment methods"
              value={settings.environment.paymentMethods
                .map((method) => (method === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : method))
                .join(', ')}
            />

            <ReadOnlyFact
              label="Distance provider"
              value={
                settings.environment.routingProvider === 'osrm'
                  ? 'OSRM (measured roads)'
                  : 'Estimate (approximate)'
              }
            />

            <ReadOnlyFact
              label="Grocery list scanning"
              value={settings.environment.aiServiceEnabled ? 'Enabled' : 'Disabled'}
            />
          </dl>

          {settings.environment.routingProvider !== 'osrm' ? (
            <p className="text-text-muted gap-2 flex items-start text-sm">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Distances are approximated from a straight line. The API refuses to start in
              production with this provider, because an approximate distance becomes a real charge.
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
