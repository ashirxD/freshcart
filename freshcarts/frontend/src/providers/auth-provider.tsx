'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { refreshSession } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Restores the session on first load.
 *
 * The access token is deliberately not persisted, so on every page load we ask
 * the API to mint a new one using the httpOnly refresh cookie. Until that call
 * settles the store reports `loading`, which stops screens from flashing a
 * signed-out state to someone who is actually signed in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    // Strict Mode runs effects twice in development; one refresh is enough.
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    void refreshSession().then((restored) => {
      if (!restored) useAuthStore.getState().markAnonymous();
    });
  }, []);

  return <>{children}</>;
}
