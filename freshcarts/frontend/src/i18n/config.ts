/**
 * Locale configuration: the one place the supported languages are declared.
 *
 * Everything else — the dictionaries, the provider, the server helper, the
 * language toggle — derives from this, so adding a language is a change here
 * plus a folder of messages rather than a hunt through the app.
 */

export const LOCALES = ['en', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];

/** Nobody is switched to another language unprompted: English until they choose. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * The persisted choice.
 *
 * A cookie rather than localStorage because the SERVER has to know it: the root
 * layout writes `<html lang dir>` from it, so an Urdu reader's first paint is
 * already right-to-left and in Urdu instead of flashing English and swapping.
 * It carries a language code and nothing else, so it is safe to leave readable
 * by script (the client sets it too) and unsigned.
 */
export const LOCALE_COOKIE = 'fc_locale';
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type Direction = 'ltr' | 'rtl';

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ur']);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/** Names are shown in their own script, so a reader can always find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ur: 'اردو',
};

/**
 * BCP 47 tags for `Intl`. Urdu is asked for Latin digits (`-u-nu-latn`): the
 * month names come out in Urdu, while the digits stay the ones prices, phone
 * numbers and order numbers are written in everywhere else in the app.
 */
export const INTL_TAGS: Record<Locale, string> = {
  en: 'en-PK',
  ur: 'ur-PK-u-nu-latn',
};
