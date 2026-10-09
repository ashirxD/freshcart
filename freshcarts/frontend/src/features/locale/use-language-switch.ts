'use client';

import { useCallback } from 'react';
import { useLocale, type Locale } from '@/i18n';
import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import type { AuthUser } from '@/types/auth';

/**
 * Changing the language, as a shopper means it.
 *
 * The screen changes immediately and the device remembers (that is
 * `setLocale`). On top of that, a SIGNED-IN user's choice is saved to their
 * profile — the API already stores `preferredLanguage` — so it follows them to
 * another phone. That save is fire-and-forget on purpose: language is a
 * presentation preference, so a failed request must never undo the switch or
 * show an error for something the screen already did.
 */
export function useLanguageSwitch() {
  const { locale, setLocale } = useLocale();

  const change = useCallback(
    (next: Locale) => {
      if (next === locale) return;

      setLocale(next);

      const { user, updateUser } = useAuthStore.getState();
      if (!user) return;

      updateUser({ preferredLanguage: next });
      void apiFetch<AuthUser>('/users/me', {
        method: 'PATCH',
        body: { preferredLanguage: next },
      }).catch(() => {
        // The cookie already holds the choice; the profile catches up next time.
      });
    },
    [locale, setLocale],
  );

  return { locale, change };
}
