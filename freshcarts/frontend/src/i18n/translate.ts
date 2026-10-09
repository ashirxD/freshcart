import { DEFAULT_LOCALE, directionOf, type Locale } from './config';
import { dictionaries, type TranslationKey } from './messages';

export type TranslationVars = Record<string, string | number>;
export type TFunction = (key: TranslationKey, vars?: TranslationVars) => string;

/** Walks `a.b.c` down a dictionary, returning only a string leaf. */
function lookup(locale: Locale, path: string): string | undefined {
  let node: unknown = dictionaries[locale];
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralCategory(locale: Locale, count: number): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

function resolve(locale: Locale, key: string, vars?: TranslationVars): string | undefined {
  if (typeof vars?.count === 'number') {
    return (
      lookup(locale, key + '_' + pluralCategory(locale, vars.count)) ??
      lookup(locale, key + '_other') ??
      lookup(locale, key)
    );
  }
  return lookup(locale, key);
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

const reportedMissing = new Set<string>();

function reportMissing(locale: Locale, key: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const id = locale + ':' + key;
  if (reportedMissing.has(id)) return;
  reportedMissing.add(id);
  console.warn('[i18n] missing "' + locale + '" translation for "' + key + '"');
}

/**
 * The translation lookup.
 *
 * Falls back from the requested language to English, and never returns
 * `undefined` or a bare key to a shopper: a key that is missing from BOTH trees
 * (which the typed `TranslationKey` makes a compile error, so this is a guard
 * against dynamic keys) renders as nothing in production and as the key itself
 * in development, where it is loud on purpose.
 */
export function translate(locale: Locale, key: TranslationKey, vars?: TranslationVars): string {
  let raw = resolve(locale, key, vars);

  if (raw === undefined && locale !== DEFAULT_LOCALE) {
    reportMissing(locale, key);
    raw = resolve(DEFAULT_LOCALE, key, vars);
  }

  if (raw === undefined) {
    reportMissing(DEFAULT_LOCALE, key);
    return process.env.NODE_ENV === 'production' ? '' : key;
  }

  return interpolate(raw, vars);
}

/**
 * The raw template for a key — placeholders still in it — for callers that
 * substitute React nodes rather than strings (see `tx` in the provider).
 * Same fallback chain as `translate`, so a missing Urdu string is English.
 */
export function translateTemplate(
  locale: Locale,
  key: TranslationKey,
  count?: number,
): string | undefined {
  const vars = typeof count === 'number' ? { count } : undefined;
  return resolve(locale, key, vars) ?? resolve(DEFAULT_LOCALE, key, vars);
}

/**
 * For keys that are assembled at runtime — `errors.${code}`, `orders.status.${s}`.
 * Returns `undefined` when there is no such key, so the caller chooses what to do
 * instead of showing a made-up key.
 */
export function translateIfKnown(
  locale: Locale,
  key: string,
  vars?: TranslationVars,
): string | undefined {
  const raw = resolve(locale, key, vars) ?? resolve(DEFAULT_LOCALE, key, vars);
  return raw === undefined ? undefined : interpolate(raw, vars);
}

export function createT(locale: Locale): TFunction {
  return (key, vars) => translate(locale, key, vars);
}

/**
 * Translates a message that MAY be a key.
 *
 * Validation schemas and a few state variables carry keys rather than prose, so
 * the text is chosen at the moment it is shown, in whatever language is active
 * THEN. A message that is not a known key (a server sentence, a user's own
 * words) is returned untouched.
 */
export function translateMessage(locale: Locale, message: string, vars?: TranslationVars): string {
  return translateIfKnown(locale, message, vars) ?? message;
}

// --- Outside React ---------------------------------------------------------------

let activeLocale: Locale = DEFAULT_LOCALE;

/**
 * The language right now, for code that runs outside a component — a toast
 * raised from a mutation callback, a schema message resolved on submit.
 *
 * Written ONLY by the client-side `LocaleProvider` (in an effect, which never
 * runs on the server), and read ONLY from event handlers and callbacks. That is
 * what keeps a module-level variable safe in a server that renders many
 * visitors' pages concurrently: nothing on the render path reads it.
 */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export const tNow: TFunction = (key, vars) => translate(activeLocale, key, vars);

/** Left-to-right isolate … pop directional isolate: invisible, and it nests. */
const LRI = '⁦';
const PDI = '⁩';

/**
 * Keeps a phone number, order number or price reading left-to-right inside a
 * right-to-left sentence. A no-op in English, so English text is byte-identical
 * to what it was before there was a second language.
 */
export function isolateLtr(locale: Locale, value: string | number): string {
  return directionOf(locale) === 'rtl' ? LRI + String(value) + PDI : String(value);
}

/** `isolateLtr` for the language active right now — see `tNow`. */
export function ltrNow(value: string | number): string {
  return isolateLtr(activeLocale, value);
}
