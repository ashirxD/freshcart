/**
 * Client-safe surface of the i18n system. (The server helpers live in
 * `./server` and are imported from there directly — they pull in
 * `next/headers`, which a client bundle must never see.)
 */
export {
  DEFAULT_LOCALE,
  INTL_TAGS,
  LOCALES,
  LOCALE_NAMES,
  directionOf,
  isLocale,
  type Direction,
  type Locale,
} from './config';
export { LocaleProvider, useI18n, useLocale, useT } from './locale-provider';
export type { TranslationKey } from './messages';
export {
  getActiveLocale,
  isolateLtr,
  ltrNow,
  tNow,
  translate,
  translateIfKnown,
  translateMessage,
  type TFunction,
  type TranslationVars,
} from './translate';
