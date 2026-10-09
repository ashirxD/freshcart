'use client';

import { useEffect, useState } from 'react';
import { CheckboxField, TextareaField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useCreateStore, useUpdateStore } from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import { weekdayName } from '@/lib/dates';
import { isValidPkMobile, normalisePkPhone } from '@/lib/phone';
import type { AdminStore, StoreOpeningHours } from '@/types/admin';

/** A sensible week for a new store; every field stays editable. */
const DEFAULT_HOURS: StoreOpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '08:00',
  closesAt: '23:00',
  isClosed: false,
}));

interface FormState {
  name: string;
  description: string;
  phone: string;
  email: string;
  line1: string;
  area: string;
  city: string;
  latitude: string;
  longitude: string;
  isActive: boolean;
  openingHours: StoreOpeningHours[];
}

const EMPTY: FormState = {
  name: '',
  description: '',
  phone: '',
  email: '',
  line1: '',
  area: '',
  city: '',
  latitude: '',
  longitude: '',
  isActive: true,
  openingHours: DEFAULT_HOURS,
};

/**
 * CREATE OR EDIT A STORE
 *
 * The coordinate pair is required and is not decoration: every delivery fee on
 * this platform is priced from the road distance between this point and the
 * shopper's address. A store saved at the wrong coordinate misprices every
 * order it takes, so the field is mandatory and validated to a real range
 * rather than accepted as free text.
 *
 * The slug is not editable here. It is derived from the name by the server and
 * kept unique there; exposing it invites two stores to fight over one URL.
 */
export function StoreDialog({
  store,
  open,
  onClose,
}: {
  store: AdminStore | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const isEditing = store !== null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);

  const create = useCreateStore(onClose);
  const update = useUpdateStore(store?.id ?? '', onClose);
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setShowErrors(false);
    setForm(
      store
        ? {
            name: store.name,
            description: store.description ?? '',
            phone: store.phone,
            email: store.email ?? '',
            line1: store.address.line1,
            area: store.address.area,
            city: store.address.city,
            // Stored as GeoJSON [longitude, latitude] — that order, not the
            // human one. Unpacked here so the form can show them the usual way.
            latitude: String(store.location.coordinates[1]),
            longitude: String(store.location.coordinates[0]),
            isActive: store.isActive,
            openingHours: store.openingHours?.length ? store.openingHours : DEFAULT_HOURS,
          }
        : EMPTY,
    );
  }, [open, store]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);

  const errors = {
    name: form.name.trim().length < 2 ? t('admin.storeDialog.errName') : undefined,
    phone: isValidPkMobile(form.phone) ? undefined : t('admin.storeDialog.errPhone'),
    line1: form.line1.trim() ? undefined : t('admin.storeDialog.errStreet'),
    area: form.area.trim() ? undefined : t('admin.storeDialog.errArea'),
    city: form.city.trim() ? undefined : t('admin.storeDialog.errCity'),
    latitude:
      Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && form.latitude !== ''
        ? undefined
        : t('admin.storeDialog.errLatitude'),
    longitude:
      Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 && form.longitude !== ''
        ? undefined
        : t('admin.storeDialog.errLongitude'),
    hours: form.openingHours.some((window) => !window.isClosed && window.closesAt <= window.opensAt)
      ? t('admin.storeDialog.errHours')
      : undefined,
  };

  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      phone: normalisePkPhone(form.phone),
      email: form.email.trim() || undefined,
      address: { line1: form.line1.trim(), area: form.area.trim(), city: form.city.trim() },
      location: { latitude, longitude },
      openingHours: form.openingHours,
      isActive: form.isActive,
    };

    if (store) update.mutate(payload);
    else create.mutate(payload);
  };

  const updateDay = (day: number, patch: Partial<StoreOpeningHours>) =>
    set(
      'openingHours',
      form.openingHours.map((window) => (window.day === day ? { ...window, ...patch } : window)),
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEditing
          ? t('admin.storeDialog.editTitle', { name: store.name })
          : t('admin.storeDialog.addTitle')
      }
      description={t('admin.storeDialog.description')}
      variant="centered"
      footer={
        <div className="gap-gutter flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} isLoading={isPending}>
            {isEditing ? t('admin.storeDialog.saveChanges') : t('admin.storeDialog.create')}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <Input
          label={t('admin.storeDialog.name')}
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={showErrors ? errors.name : undefined}
        />

        <TextareaField
          label={t('admin.storeDialog.descriptionLabel')}
          rows={2}
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
        />

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label={t('admin.storeDialog.phone')}
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
            error={showErrors ? errors.phone : undefined}
            hint="03001234567"
          />

          <Input
            label={t('admin.storeDialog.email')}
            type="email"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
          />
        </div>

        <Input
          label={t('admin.storeDialog.street')}
          value={form.line1}
          onChange={(event) => set('line1', event.target.value)}
          error={showErrors ? errors.line1 : undefined}
        />

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label={t('admin.storeDialog.area')}
            value={form.area}
            onChange={(event) => set('area', event.target.value)}
            error={showErrors ? errors.area : undefined}
          />

          <Input
            label={t('admin.storeDialog.city')}
            value={form.city}
            onChange={(event) => set('city', event.target.value)}
            error={showErrors ? errors.city : undefined}
          />
        </div>

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label={t('admin.storeDialog.latitude')}
            type="number"
            inputMode="decimal"
            step="any"
            value={form.latitude}
            onChange={(event) => set('latitude', event.target.value)}
            error={showErrors ? errors.latitude : undefined}
            hint={t('admin.storeDialog.latitudeHint')}
          />

          <Input
            label={t('admin.storeDialog.longitude')}
            type="number"
            inputMode="decimal"
            step="any"
            value={form.longitude}
            onChange={(event) => set('longitude', event.target.value)}
            error={showErrors ? errors.longitude : undefined}
            hint={t('admin.storeDialog.longitudeHint')}
          />
        </div>

        <fieldset className="border-outline-variant gap-tight flex flex-col rounded-xl border p-3">
          <legend className="text-text px-1 text-sm font-medium">
            {t('admin.storeDialog.openingHours')}
          </legend>

          {form.openingHours.map((window) => (
            <div key={window.day} className="gap-gutter flex flex-wrap items-center">
              <span className="text-text w-12 shrink-0 text-sm font-medium">
                {weekdayName(window.day, locale, 'short')}
              </span>

              <label className="min-h-touch flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={window.isClosed}
                  onChange={(event) => updateDay(window.day, { isClosed: event.target.checked })}
                  className="size-5 accent-[var(--color-primary)]"
                />
                <span className="text-text-muted">{t('common.closed')}</span>
              </label>

              <input
                type="time"
                aria-label={t('admin.storeDialog.opening', { day: weekdayName(window.day, locale, 'short') })}
                value={window.opensAt}
                disabled={window.isClosed}
                onChange={(event) => updateDay(window.day, { opensAt: event.target.value })}
                className="border-outline-variant bg-surface text-text min-h-touch rounded-md border px-2 text-sm disabled:opacity-50"
              />

              <span className="text-text-muted text-sm" aria-hidden="true">
                {t('admin.storeDialog.to')}
              </span>

              <input
                type="time"
                aria-label={t('admin.storeDialog.closing', { day: weekdayName(window.day, locale, 'short') })}
                value={window.closesAt}
                disabled={window.isClosed}
                onChange={(event) => updateDay(window.day, { closesAt: event.target.value })}
                className="border-outline-variant bg-surface text-text min-h-touch rounded-md border px-2 text-sm disabled:opacity-50"
              />
            </div>
          ))}

          {showErrors && errors.hours ? (
            <p role="alert" className="text-danger text-sm">
              {errors.hours}
            </p>
          ) : null}
        </fieldset>

        <CheckboxField
          label={t('admin.storeDialog.tradingLabel')}
          hint={t('admin.storeDialog.tradingHint')}
          checked={form.isActive}
          onChange={(checked) => set('isActive', checked)}
        />
      </div>
    </Modal>
  );
}
