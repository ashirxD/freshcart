import { INTL_TAGS, type Locale } from '@/i18n';

/**
 * ONE PLACE DATES ARE FORMATTED
 *
 * Every date in the app used to call `toLocaleString('en-PK', …)` directly, so
 * the month names were English whatever language the screen was in. This takes
 * the locale instead: Urdu readers get Urdu month names, and the digits stay
 * Latin (`INTL_TAGS` asks for `-u-nu-latn`) so a date reads in the same figures
 * as the prices and order numbers around it.
 *
 * Three presets cover everything the app shows; add one here rather than
 * spelling options out at a call site.
 */
const PRESETS = {
  /** "2 Feb, 3:40 pm" — short enough for a phone. */
  moment: { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true },
  /** "2 Feb 2026, 3:40 pm" */
  dateTime: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },
  /** "2 Feb 2026" */
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  /** "2 Feb" */
  shortDate: { day: 'numeric', month: 'short' },
  /** "3:40 pm" */
  time: { hour: 'numeric', minute: '2-digit', hour12: true },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof PRESETS;

/**
 * A weekday's name in the active language. Day 0 is Sunday, the way the API
 * numbers opening hours; 7 Jan 2024 was a Sunday, so counting from it gives
 * every other day without a table of names to keep in two languages.
 */
export function weekdayName(
  day: number,
  locale: Locale,
  style: 'long' | 'short' = 'long',
): string {
  return new Date(2024, 0, 7 + day).toLocaleDateString(INTL_TAGS[locale], { weekday: style });
}

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  style: DateStyle = 'dateTime',
): string {
  return new Date(value).toLocaleString(INTL_TAGS[locale], PRESETS[style]);
}
