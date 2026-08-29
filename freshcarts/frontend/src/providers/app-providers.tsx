'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { createQueryClient } from '@/lib/api/query-client';
import { AuthProvider } from './auth-provider';

/**
 * Single client-side provider boundary for the whole app, so the root layout
 * stays a server component.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Created once per browser session — never at module scope, which would leak
  // one user's cache into another request during SSR.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
