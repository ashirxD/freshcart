import { z } from 'zod';
import { PK_MOBILE_E164, normalisePkPhone } from '@/lib/phone';

/**
 * These schemas mirror the backend DTOs so the shopper gets immediate feedback.
 * They are a convenience layer only: the API validates every field again and
 * remains the single authority.
 */
const phoneField = z
  .string()
  .min(1, 'Mobile number is required')
  .transform(normalisePkPhone)
  .refine((value) => PK_MOBILE_E164.test(value), {
    message: 'Enter a valid mobile number, e.g. 0300 1234567',
  });

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const loginSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name')
    .max(80, 'Name is too long'),
  phone: phoneField,
  password: passwordField,
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterValues = z.output<typeof registerSchema>;
