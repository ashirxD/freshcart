import { apiFetch } from '@/lib/api/client';
import type { LoginValues, RegisterValues } from '@/lib/validation/auth.schema';
import type { AuthUser, Language, SessionResponse } from '@/types/auth';

/**
 * Transport only. No caching, no state, no toasts — those belong to the hooks
 * that call these functions.
 */
export const authApi = {
  login: (values: LoginValues) =>
    apiFetch<SessionResponse>('/auth/login', { method: 'POST', body: values }),

  // The language the shopper registered in is saved on the account, so their
  // next device starts in it (the API already stores `preferredLanguage`).
  register: (values: RegisterValues, preferredLanguage?: Language) =>
    apiFetch<SessionResponse>('/auth/register', {
      method: 'POST',
      body: preferredLanguage ? { ...values, preferredLanguage } : values,
    }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<AuthUser>('/auth/me'),
};
