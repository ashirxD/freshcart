import { translateIfKnown, type Locale } from '@/i18n';

/**
 * Who did something, in words a person reads — "the customer", "store staff",
 * "an administrator". The API sends an enum; an unrecognised one is shown
 * lower-cased rather than hidden.
 */
export function whoLabel(role: string, locale: Locale): string {
  return translateIfKnown(locale, 'admin.who.' + role) ?? role.toLowerCase();
}
