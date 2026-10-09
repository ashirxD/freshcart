import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { createT, type TFunction } from './translate';

/**
 * The language for the request being rendered, from the cookie the client
 * writes. Anything missing or unrecognised is English — never an error, and
 * never a language the visitor did not pick.
 */
export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

/** For server components and `generateMetadata`. */
export async function getT(): Promise<TFunction> {
  return createT(await getLocale());
}
