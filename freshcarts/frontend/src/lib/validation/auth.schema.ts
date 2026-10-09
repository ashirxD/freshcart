import { z } from 'zod';
import { PK_MOBILE_E164, normalisePkPhone } from '@/lib/phone';

/**
 * MESSAGES ARE KEYS
 * Every message below is a translation key (`validation.*`), not prose. A schema
 * is built once, at import time, so baking English into it would fix the
 * language forever; the field components translate the key at the moment they
 * show it, in whatever language is active THEN.
 *
 * These schemas mirror the backend DTOs so the shopper gets immediate feedback.
 * They are a convenience layer only: the API validates every field again and
 * remains the single authority.
 */
const phoneField = z
  .string()
  .min(1, 'validation.phoneRequired')
  .transform(normalisePkPhone)
  .refine((value) => PK_MOBILE_E164.test(value), {
    message: 'validation.phoneInvalid',
  });

const passwordField = z
  .string()
  .min(8, 'validation.passwordMin')
  .max(72, 'validation.passwordMax')
  .regex(/[A-Za-z]/, 'validation.passwordLetter')
  .regex(/\d/, 'validation.passwordNumber');

export const loginSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, 'validation.passwordRequired'),
});

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'validation.nameRequired')
    .max(80, 'validation.nameTooLong'),
  phone: phoneField,
  password: passwordField,
  email: z
    .string()
    .trim()
    .email('validation.emailInvalid')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterValues = z.output<typeof registerSchema>;
