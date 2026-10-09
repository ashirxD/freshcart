'use client';

import * as reactQuery from '@tanstack/react-query';
import { useHydrated } from '@/lib/use-hydrated';

/**
 * Hydration-safe drop-ins for TanStack Query's `useQuery` / `useInfiniteQuery`.
 *
 * THE PROBLEM
 * Every page here is server-rendered with no data — the server never fetches,
 * so a query is always `pending` in the HTML. The browser, though, starts
 * fetching as soon as the first component that wants the data hydrates. Next
 * streams the page in Suspense boundaries (`loading.tsx`, and `<Suspense>`
 * around `useSearchParams`), and the shell hydrates before the page inside
 * them. If the shell's request lands before the page hydrates — likely on a
 * slow phone, where hydration takes longest — the page's FIRST client render
 * already has data and no longer matches the HTML. React then throws the
 * boundary away and re-renders it from scratch.
 *
 * THE FIX
 * During the hydration render, report `pending` exactly as the server did; from
 * the very next render, report the real result. Cached data still shows
 * immediately on client navigation, because `useHydrated` is `true` for any
 * component that was not server-rendered.
 *
 * Only the result is wrapped, never the options, so every call site keeps
 * TanStack's own types. Import these from here instead of the library.
 */
function pendingLike<T extends object>(result: T): T {
  return {
    ...result,
    data: undefined,
    error: null,
    status: 'pending',
    isPending: true,
    isSuccess: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: true,
    isFetched: false,
    isFetchedAfterMount: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    hasNextPage: false,
    isFetchingNextPage: false,
  } as T;
}

export const useQuery: typeof reactQuery.useQuery = ((
  options: Parameters<typeof reactQuery.useQuery>[0],
  queryClient?: reactQuery.QueryClient,
) => {
  const result = reactQuery.useQuery(options, queryClient);
  const hydrated = useHydrated();
  return hydrated ? result : pendingLike(result);
}) as typeof reactQuery.useQuery;

export const useInfiniteQuery: typeof reactQuery.useInfiniteQuery = ((
  options: Parameters<typeof reactQuery.useInfiniteQuery>[0],
  queryClient?: reactQuery.QueryClient,
) => {
  const result = reactQuery.useInfiniteQuery(options, queryClient);
  const hydrated = useHydrated();
  return hydrated ? result : pendingLike(result);
}) as typeof reactQuery.useInfiniteQuery;
