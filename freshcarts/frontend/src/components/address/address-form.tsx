'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Home, LocateFixed, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import {
  addressFormSchema,
  emptyAddressForm,
  toAddressInput,
  type AddressFormValues,
} from '@/lib/validation/address.schema';
import type { AddressInput } from '@/types/address';

export interface AddressFormProps {
  defaultValues?: AddressFormValues;
  onSubmit: (input: AddressInput) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Offers "make this my default" — hidden when editing the only address. */
  showDefaultToggle?: boolean;
}

const LABEL_OPTIONS = [
  { value: 'HOME', titleKey: 'addresses.label.HOME', icon: <Home className="size-5" /> },
  { value: 'WORK', titleKey: 'addresses.label.WORK', icon: <Building2 className="size-5" /> },
  { value: 'OTHER', titleKey: 'addresses.label.OTHER', icon: <MapPin className="size-5" /> },
] as const;

/** How precise a browser fix has to be before it is worth saving. */
const ACCEPTABLE_ACCURACY_METRES = 500;

/**
 * `failed` carries a message KEY (plus the one figure some messages mention),
 * not prose, so the sentence is chosen at render time and follows the language
 * if it is switched while the message is on screen.
 */
type LocationState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'found'; accuracy: number }
  | {
      kind: 'failed';
      message: 'addresses.form.noGeolocation' | 'addresses.form.tooVague' | 'addresses.form.permissionDenied' | 'addresses.form.locationFailed';
      metres?: number;
    };

/**
 * The address form.
 *
 * LOCATION (§21)
 * Three ways to set the map pin are described in the milestone: current
 * location, a map, and manual entry. Two are built here: the browser's own
 * geolocation, and manual coordinates. A map picker is deliberately not
 * faked — no tile provider is configured, and a non-functional "Select on map"
 * button is worse than an honest omission. The address model, the API and this
 * form all carry coordinates, so adding a map later is one component swapped
 * into the slot below and nothing else.
 *
 * Coordinates are optional. Many Pakistani addresses are landmark-based with no
 * clean geocode, and refusing to save one would be worse than saving it and
 * telling the shopper at checkout that delivery needs a location.
 */
export function AddressForm({
  defaultValues = emptyAddressForm,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel,
  showDefaultToggle = true,
}: AddressFormProps) {
  const t = useT();
  const [location, setLocation] = useState<LocationState>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const label = watch('label');
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const hasCoordinates = latitude !== '' && longitude !== '';

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocation({ kind: 'failed', message: 'addresses.form.noGeolocation' });
      return;
    }

    setLocation({ kind: 'locating' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;

        if (accuracy > ACCEPTABLE_ACCURACY_METRES) {
          // A fix this vague would put the delivery fee in the wrong band, so
          // it is reported rather than silently used.
          setLocation({
            kind: 'failed',
            message: 'addresses.form.tooVague',
            metres: Math.round(accuracy),
          });
          return;
        }

        // Six decimals is roughly 10 cm — far more than enough, and it keeps
        // the value short enough to read in the manual fields.
        setValue('latitude', lat.toFixed(6), { shouldValidate: true });
        setValue('longitude', lng.toFixed(6), { shouldValidate: true });
        setLocation({ kind: 'found', accuracy });
      },
      (error) => {
        setLocation({
          kind: 'failed',
          message:
            error.code === error.PERMISSION_DENIED
              ? 'addresses.form.permissionDenied'
              : 'addresses.form.locationFailed',
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(toAddressInput(values)))}
      className="gap-loose flex flex-col"
      noValidate
    >
      <RadioCardGroup
        label={t('addresses.form.kindQuestion')}
        value={label}
        onChange={(value) => setValue('label', value as AddressFormValues['label'])}
        className="gap-tight"
      >
        <div className="gap-tight grid grid-cols-3">
          {LABEL_OPTIONS.map((option) => (
            <RadioCard
              key={option.value}
              value={option.value}
              title={t(option.titleKey)}
              icon={option.icon}
            />
          ))}
        </div>
      </RadioCardGroup>

      <div className="gap-gutter flex flex-col">
        <Input
          label={t('addresses.form.recipient')}
          autoComplete="name"
          error={errors.recipientName?.message}
          {...register('recipientName')}
        />

        <Input
          label={t('addresses.form.mobile')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0300 1234567"
          hint={t('addresses.form.mobileHint')}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label={t('addresses.form.house')}
          autoComplete="address-line1"
          error={errors.houseNumber?.message}
          {...register('houseNumber')}
        />

        <Input
          label={t('addresses.form.street')}
          autoComplete="address-line2"
          error={errors.street?.message}
          {...register('street')}
        />

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label={t('addresses.form.area')}
            autoComplete="address-level2"
            error={errors.area?.message}
            {...register('area')}
          />
          <Input
            label={t('addresses.form.city')}
            autoComplete="address-level1"
            error={errors.city?.message}
            {...register('city')}
          />
        </div>

        <Input
          label={t('addresses.form.landmark')}
          hint={t('addresses.form.landmarkHint')}
          placeholder={t('addresses.form.landmarkPlaceholder')}
          error={errors.landmark?.message}
          {...register('landmark')}
        />

        <Textarea
          label={t('addresses.form.instructions')}
          hint={t('addresses.form.instructionsHint')}
          error={errors.deliveryInstructions?.message}
          {...register('deliveryInstructions')}
        />

        <Input
          label={t('addresses.form.nickname')}
          hint={t('addresses.form.nicknameHint')}
          error={errors.nickname?.message}
          {...register('nickname')}
        />
      </div>

      {/* --- Map location ------------------------------------------------- */}
      <section
        aria-labelledby="address-location-heading"
        className="gap-gutter border-outline-variant bg-surface-muted p-gutter flex flex-col rounded-lg border"
      >
        <div className="flex flex-col gap-1">
          <h3 id="address-location-heading" className="text-text text-base font-semibold">
            {t('addresses.form.mapTitle')}
          </h3>
          <p className="text-text-muted text-sm">
            {t('addresses.form.mapBody')}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          isLoading={location.kind === 'locating'}
          leadingIcon={<LocateFixed className="size-4" aria-hidden="true" />}
          className="self-start"
        >
          {t('addresses.form.useLocation')}
        </Button>

        {/* Announced, not just shown: the result of a location request is the
            kind of change a screen-reader user must hear. */}
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'text-sm',
            location.kind === 'failed' ? 'text-danger' : 'text-text-muted',
            location.kind === 'idle' && 'sr-only',
          )}
        >
          {location.kind === 'locating' ? t('addresses.form.finding') : null}
          {location.kind === 'found'
            ? t('addresses.form.locationSet', { metres: Math.round(location.accuracy) })
            : null}
          {location.kind === 'failed'
            ? t(location.message, location.metres === undefined ? undefined : { metres: location.metres })
            : null}
        </p>

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label={t('addresses.form.latitude')}
            inputMode="decimal"
            placeholder="31.545000"
            error={errors.latitude?.message}
            {...register('latitude')}
          />
          <Input
            label={t('addresses.form.longitude')}
            inputMode="decimal"
            placeholder="74.372000"
            error={errors.longitude?.message}
            {...register('longitude')}
          />
        </div>

        {hasCoordinates ? (
          <p className="text-success flex items-center gap-1.5 text-sm">
            <MapPin className="size-4" aria-hidden="true" />
            {t('addresses.form.canCalculate')}
          </p>
        ) : null}
      </section>

      {showDefaultToggle ? (
        <label className="min-h-touch gap-gutter border-outline-variant bg-surface px-gutter flex cursor-pointer items-center rounded-lg border">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-primary)]"
            {...register('isDefault')}
          />
          <span className="text-text text-sm font-medium">
            {t('addresses.form.makeDefaultCheckbox')}
          </span>
        </label>
      ) : null}

      <div className="gap-tight flex flex-col-reverse sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            fullWidth
            className="sm:w-auto"
          >
            {t('common.cancel')}
          </Button>
        ) : null}

        <Button type="submit" isLoading={isSubmitting} fullWidth className="sm:w-auto">
          {submitLabel ?? t('addresses.form.saveAddress')}
        </Button>
      </div>
    </form>
  );
}
