import { apiFetch } from '@/lib/api/client';
import type { LoginValues, RegisterValues } from '@/lib/validation/auth.schema';
import type { AuthUser, SessionResponse } from '@/types/auth';

/**
 * Transport only. No caching, no state, no toasts — those belong to the hooks
 * that call these functions.
 */
export const authApi = {
  login: (values: LoginValues) =>
    apiFetch<SessionResponse>('/auth/login', { method: 'POST', body: values }),

  register: (values: RegisterValues) =>
    apiFetch<SessionResponse>('/auth/register', { method: 'POST', body: values }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<AuthUser>('/auth/me'),
};
