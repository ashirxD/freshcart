import { z } from 'zod';
import { PK_MOBILE_E164, normalisePkPhone } from '@/lib/phone';
import type { AddressInput } from '@/types/address';

/**
 * The address form.
 *
 * Describes the *form*, not the API payload: every field is exactly what the
 * input element produces, so React Hook Form manages the same shape the shopper
 * sees. Turning a filled-in form into a request is a separate, explicit step —
 * `toAddressInput` at the bottom.
 *
 * A convenience layer. The API validates every field again and remains the
 * authority; rules that need server state are deliberately absent rather than
 * half-reimplemented here.
 *
 * Messages are translation KEYS (`validation.*`), translated where they are
 * shown — see `auth.schema.ts`.
 */
const phoneField = z
  .string()
  .min(1, 'validation.phoneRequired')
  .transform(normalisePkPhone)
  .refine((value) => PK_MOBILE_E164.test(value), {
    message: 'validation.phoneInvalid',
  });

/**
 * Coordinates are strings in the form because that is what a number input
 * yields, and because "not set" must be expressible — an empty field, not zero.
 * Zero is a real coordinate in the Gulf of Guinea.
 */
const coordinateField = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max),
      { message },
    );

export const addressFormSchema = z
  .object({
    label: z.enum(['HOME', 'WORK', 'OTHER']),
    nickname: z.string().trim().max(60, 'validation.nicknameTooLong'),
    recipientName: z
      .string()
      .trim()
      .min(2, 'validation.recipientRequired')
      .max(80, 'validation.recipientTooLong'),
    phone: phoneField,
    houseNumber: z
      .string()
      .trim()
      .min(1, 'validation.houseRequired')
      .max(60, 'validation.tooLong'),
    street: z.string().trim().min(1, 'validation.streetRequired').max(120, 'validation.tooLong'),
    area: z.string().trim().min(1, 'validation.areaRequired').max(100, 'validation.tooLong'),
    city: z.string().trim().min(1, 'validation.cityRequired').max(80, 'validation.tooLong'),
    landmark: z.string().trim().max(160, 'validation.tooLong'),
    deliveryInstructions: z.string().trim().max(300, 'validation.tooLong'),
    latitude: coordinateField(-90, 90, 'validation.latitudeRange'),
    longitude: coordinateField(-180, 180, 'validation.longitudeRange'),
    isDefault: z.boolean(),
  })
  .refine((values) => (values.latitude === '') === (values.longitude === ''), {
    message: 'validation.mapOrNone',
    path: ['latitude'],
  });

export type AddressFormValues = z.infer<typeof addressFormSchema>;

export const emptyAddressForm: AddressFormValues = {
  label: 'HOME',
  nickname: '',
  recipientName: '',
  phone: '',
  houseNumber: '',
  street: '',
  area: '',
  city: '',
  landmark: '',
  deliveryInstructions: '',
  latitude: '',
  longitude: '',
  isDefault: false,
};

/**
 * Form values -> API payload.
 *
 * Empty optional strings become `undefined` rather than `''`: the API treats
 * "not sent" and "sent as empty" differently on update, and an empty string
 * would overwrite a landmark the shopper never meant to clear.
 */
export function toAddressInput(values: AddressFormValues): AddressInput {
  const optional = (value: string) => (value === '' ? undefined : value);
  const hasCoordinates = values.latitude !== '' && values.longitude !== '';

  return {
    label: values.label,
    nickname: optional(values.nickname),
    recipientName: values.recipientName,
    phone: values.phone,
    houseNumber: values.houseNumber,
    street: values.street,
    area: values.area,
    city: values.city,
    landmark: optional(values.landmark),
    deliveryInstructions: optional(values.deliveryInstructions),
    ...(hasCoordinates
      ? { latitude: Number(values.latitude), longitude: Number(values.longitude) }
      : {}),
    isDefault: values.isDefault,
  };
}

/** API record -> form values, for the edit flow. */
export function toAddressForm(address: {
  label: 'HOME' | 'WORK' | 'OTHER';
  nickname?: string;
  recipientName: string;
  phone: string;
  houseNumber: string;
  street: string;
  area: string;
  city: string;
  landmark?: string;
  deliveryInstructions?: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}): AddressFormValues {
  return {
    label: address.label,
    nickname: address.nickname ?? '',
    recipientName: address.recipientName,
    phone: address.phone,
    houseNumber: address.houseNumber,
    street: address.street,
    area: address.area,
    city: address.city,
    landmark: address.landmark ?? '',
    deliveryInstructions: address.deliveryInstructions ?? '',
    latitude: address.latitude === null ? '' : String(address.latitude),
    longitude: address.longitude === null ? '' : String(address.longitude),
    isDefault: address.isDefault,
  };
}
