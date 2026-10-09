'use client';

import { useEffect } from 'react';
import { useLocale } from '@/i18n';
import { readLocaleCookie } from '@/i18n/cookie';
import { useAuthStore } from '@/store/auth.store';

/**
 * Applies a saved profile preference — but only when this device has none.
 *
 * The order is: the language chosen on this device (the cookie) beats the one
 * saved on the profile, which beats English. So a shopper who set Urdu on their
 * phone and signs in on a borrowed laptop gets Urdu there too, while someone who
 * deliberately picked English on THIS device is never overridden by a profile
 * written elsewhere. Every existing account has `en` saved, so nobody is moved
 * to Urdu unexpectedly.
 */
export function LocaleSync() {
  const { locale, setLocale } = useLocale();
  const userId = useAuthStore((state) => state.user?.id);
  const preferred = useAuthStore((state) => state.user?.preferredLanguage);

  useEffect(() => {
    if (!userId || !preferred) return;
    if (readLocaleCookie() !== null) return;
    if (preferred !== locale) setLocale(preferred);
  }, [userId, preferred, locale, setLocale]);

  return null;
}
