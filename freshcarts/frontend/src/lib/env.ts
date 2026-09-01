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
    'Invalid client environment configuration: ' +
      parsed.error.issues.map((i) => i.message).join(', '),
  );
}

/**
 * The API's origin, without the version prefix.
 *
 * Uploaded product photography is served at `/media/<key>`, which sits at the
 * origin rather than under `/api/v1` — an image URL is stored on a product
 * document and must not move when the API version does. Derived here rather
 * than configured separately, so there is no second variable to keep in step
 * with the first.
 */
const apiOrigin = new URL(parsed.data.apiUrl).origin;

export const env = { ...parsed.data, apiOrigin };
