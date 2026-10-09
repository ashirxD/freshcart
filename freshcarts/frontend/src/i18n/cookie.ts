import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  isLocale,
  type Locale,
} from './config';

/**
 * Browser-side access to the persisted choice. The server reads the same cookie
 * through `next/headers` (see `server.ts`); this is how the client WRITES it and
 * how it asks "has this device ever chosen?", which is a different question
 * from "what is the current language?" — see `LocaleSync`.
 */
export function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(LOCALE_COOKIE + '='));
  const value = match?.slice(LOCALE_COOKIE.length + 1);

  return isLocale(value) ? value : null;
}

export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    LOCALE_COOKIE +
    '=' +
    locale +
    '; Path=/; Max-Age=' +
    LOCALE_COOKIE_MAX_AGE_SECONDS +
    '; SameSite=Lax' +
    secure;
}

/** What the language is when nothing says otherwise. */
export const FALLBACK_LOCALE: Locale = DEFAULT_LOCALE;
