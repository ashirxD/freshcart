'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { LocaleProvider, type Locale } from '@/i18n';
import { createQueryClient } from '@/lib/api/query-client';
import { AuthProvider } from './auth-provider';
import { LocaleSync } from './locale-sync';

/**
 * Single client-side provider boundary for the whole app, so the root layout
 * stays a server component.
 */
export function AppProviders({
  children,
  initialLocale,
}: {
  children: ReactNode;
  /** The language the server rendered the page in, read from the cookie. */
  initialLocale: Locale;
}) {
  // Created once per browser session — never at module scope, which would leak
  // one user's cache into another request during SSR.
  const [queryClient] = useState(createQueryClient);

  return (
    <LocaleProvider initialLocale={initialLocale}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
        <LocaleSync />
        <Toaster />
      </QueryClientProvider>
    </LocaleProvider>
  );
}
