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
 */
const phoneField = z
  .string()
  .min(1, 'Mobile number is required')
  .transform(normalisePkPhone)
  .refine((value) => PK_MOBILE_E164.test(value), {
    message: 'Enter a valid mobile number, e.g. 0300 1234567',
  });

/**
 * Coordinates are strings in the form because that is what a number input
 * yields, and because "not set" must be expressible — an empty field, not zero.
 * Zero is a real coordinate in the Gulf of Guinea.
 */
const coordinateField = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max),
      { message: 'Enter a valid ' + label + ' between ' + min + ' and ' + max },
    );

export const addressFormSchema = z
  .object({
    label: z.enum(['HOME', 'WORK', 'OTHER']),
    nickname: z.string().trim().max(60, 'That nickname is too long'),
    recipientName: z
      .string()
      .trim()
      .min(2, 'Please enter who should receive the order')
      .max(80, 'That name is too long'),
    phone: phoneField,
    houseNumber: z
      .string()
      .trim()
      .min(1, 'House, flat or shop number is required')
      .max(60, 'That is too long'),
    street: z.string().trim().min(1, 'Street is required').max(120, 'That is too long'),
    area: z.string().trim().min(1, 'Area is required').max(100, 'That is too long'),
    city: z.string().trim().min(1, 'City is required').max(80, 'That is too long'),
    landmark: z.string().trim().max(160, 'That is too long'),
    deliveryInstructions: z.string().trim().max(300, 'That is too long'),
    latitude: coordinateField(-90, 90, 'latitude'),
    longitude: coordinateField(-180, 180, 'longitude'),
    isDefault: z.boolean(),
  })
  .refine((values) => (values.latitude === '') === (values.longitude === ''), {
    message: 'Set the map location, or leave both coordinates empty',
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
