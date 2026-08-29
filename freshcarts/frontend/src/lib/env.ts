import { z } from 'zod';

/**
 * Public runtime configuration. Next inlines NEXT_PUBLIC_* at build time, so the
 * reference below must be a literal property access, not a dynamic lookup.
 */
const schema = z.object({
  apiUrl: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
});

const parsed = schema.safeParse({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  throw new Error(
    'Invalid client environment configuration: ' + parsed.error.issues.map((i) => i.message).join(', '),
  );
}

export const env = parsed.data;
