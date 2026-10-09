import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';

/**
 * Session state lives in memory only — deliberately NOT persisted.
 *
 * The access token is short lived and never written to localStorage, so an XSS
 * bug cannot exfiltrate a durable credential. Continuity across reloads comes
 * from the httpOnly refresh cookie via the silent-refresh call in AuthProvider.
 */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: SessionStatus;
  setSession: (user: AuthUser, accessToken: string) => void;
  /** Merges profile fields into the signed-in user without touching the session. */
  updateUser: (patch: Partial<AuthUser>) => void;
  clearSession: () => void;
  markAnonymous: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
  clearSession: () => set({ user: null, accessToken: null, status: 'anonymous' }),
  markAnonymous: () => set({ status: 'anonymous' }),
}));

/** Read the current token outside React (used by the API client). */
export const getAccessToken = (): string | null => useAuthStore.getState().accessToken;
