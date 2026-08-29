import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

/**
 * One place for cache policy so screens do not each invent their own.
 * Client errors are never retried — retrying a 400 or 403 just wastes a request
 * and delays the message the shopper needs to see.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
