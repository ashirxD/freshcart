'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import type { LoginValues, RegisterValues } from '@/lib/validation/auth.schema';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { SessionResponse } from '@/types/auth';
import { authApi } from './auth.api';

/**
 * Screens call these hooks and render; everything else — writing the session,
 * clearing caches, routing, error messaging — is handled once, here.
 */
export function useLogin(redirectTo = '/') {
  return useSessionMutation(authApi.login, redirectTo, 'Welcome back');
}

export function useRegister(redirectTo = '/') {
  return useSessionMutation(authApi.register, redirectTo, 'Your account is ready');
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: authApi.logout,
    // Clear locally regardless of the network result: the refresh cookie is
    // already gone or the session is unusable either way.
    onSettled: () => {
      clearSession();
      queryClient.clear();
      router.push('/login');
    },
  });
}

function useSessionMutation<TValues extends LoginValues | RegisterValues>(
  mutationFn: (values: TValues) => Promise<SessionResponse>,
  redirectTo: string,
  successMessage: string,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (session) => {
      setSession(session.user, session.accessToken);
      // Anything cached for the previous (anonymous) visitor is now wrong.
      void queryClient.invalidateQueries();
      toast({ title: successMessage, variant: 'success' });
      router.push(redirectTo);
    },
    onError: (error: unknown) => {
      toast({
        title: 'Could not sign you in',
        description:
          error instanceof ApiError ? error.message : 'Please check your connection and try again.',
        variant: 'error',
      });
    },
  });
}
