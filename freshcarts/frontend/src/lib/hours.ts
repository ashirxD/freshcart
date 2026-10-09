'use client';

import { useEffect, useState } from 'react';
import type { OpeningHours } from '@/types/catalog';

/**
 * OPENING HOURS
 *
 * The store publishes a row per weekday, so anything that says "open today"
 * has to decide which day today is — and that is a genuinely awkward question
 * in a server-rendered app. A server in UTC and a shopper in Lahore disagree
 * about the date for five hours out of every twenty-four, so rendering the day
 * during SSR produces a line that is occasionally wrong and a hydration
 * mismatch on top of it.
 *
 * `useTodayIndex` therefore returns null until the component has mounted, and
 * the weekday after that. Callers render nothing in the meantime: an absent
 * line is fine, a line that says the shop is closed when it is open is not.
 *
 * Both callers assume the shopper shares the shop's timezone, which for a
 * neighbourhood grocery in Lahore is the whole customer base. The API does not
 * publish the store's UTC offset, so there is nothing more precise available
 * here — and inventing one would be worse than the assumption.
 */
export function useTodayIndex(): number | null {
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => setDay(new Date().getDay()), []);
  return day;
}

/** The schedule row for a weekday, or null when the store has no schedule. */
export function hoursForDay(
  openingHours: OpeningHours[] | undefined,
  day: number | null,
): OpeningHours | null {
  if (!openingHours?.length || day === null) return null;
  return openingHours.find((entry) => entry.day === day) ?? null;
}

/**
 * "8:00 – 23:00", or the word for "closed" — never a guess.
 *
 * The word is a parameter because this helper is not a component and so cannot
 * choose a language itself; the caller passes `t('common.closed')`.
 */
export function describeHours(entry: OpeningHours | null, closedLabel = 'Closed'): string | null {
  if (!entry) return null;
  return entry.isClosed ? closedLabel : entry.opensAt + ' – ' + entry.closesAt;
}
