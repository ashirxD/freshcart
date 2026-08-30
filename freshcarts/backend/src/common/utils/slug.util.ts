/**
 * Slug generation is server-side only.
 *
 * A client may *suggest* a slug, but the value that reaches the database always
 * passes through here, so uniqueness checks, redirects and URLs can rely on one
 * deterministic transformation instead of whatever the browser sent.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      // Drop combining marks so "Añejo" becomes "anejo" rather than "aejo".
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      // Apostrophes are elided rather than turned into separators, so
      // "Olper's Milk" reads as `olpers-milk` and not `olper-s-milk`.
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '')
  );
}

/**
 * Produces a slug that does not collide, by appending -2, -3, ... The caller
 * supplies the existence check so this stays free of database concerns.
 */
export async function uniqueSlug(
  desired: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(desired);
  if (!base) throw new Error('Cannot derive a slug from an empty value');

  if (!(await exists(base))) return base;

  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = base + '-' + suffix;
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error('Could not derive a unique slug for "' + desired + '"');
}
