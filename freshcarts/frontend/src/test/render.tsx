import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { LocaleProvider, type Locale } from '@/i18n';
import { useAuthStore } from '@/store/auth.store';
import type { AuthUser } from '@/types/auth';

/**
 * A query client with retries off and caching disabled.
 *
 * Retries would turn an intentionally failing request into a multi-second test,
 * and a shared cache would leak one test's data into the next — the two things
 * that make React Query tests flaky.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export const testCustomer: AuthUser = {
  id: '64b000000000000000000009',
  fullName: 'Ayesha Khan',
  phone: '+923001234569',
  role: 'CUSTOMER',
  isActive: true,
  preferredLanguage: 'en',
  phoneVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Puts a signed-in customer in the auth store, as AuthProvider would. */
export function signIn(user: AuthUser = testCustomer): void {
  useAuthStore.getState().setSession(user, 'test-access-token');
}

export function signOut(): void {
  useAuthStore.getState().clearSession();
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  /** Renders in this language. Omitted, the screen is in English, as it is by default. */
  locale?: Locale;
}

/**
 * Renders inside the providers a customer screen actually runs under, so a
 * component is exercised the way the app mounts it rather than in isolation
 * from the data layer it depends on.
 */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const { locale, ...renderOptions } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return locale ? <LocaleProvider initialLocale={locale}>{tree}</LocaleProvider> : tree;
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
