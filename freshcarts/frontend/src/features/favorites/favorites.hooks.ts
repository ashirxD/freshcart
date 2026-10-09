'use client';

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@/lib/api/query-hooks';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { tNow } from '@/i18n';
import { describeError } from '@/lib/api/error-copy';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { Favorite } from '@/types/cart';
import type { Paginated } from '@/types/catalog';

export const favoriteKeys = {
  all: ['favorites'] as const,
  list: (page: number) => [...favoriteKeys.all, 'list', page] as const,
  ids: () => [...favoriteKeys.all, 'ids'] as const,
};

const favoritesApi = {
  list: (page: number, limit = 20) =>
    apiFetch<Paginated<Favorite>>('/favorites?page=' + page + '&limit=' + limit),

  ids: () => apiFetch<string[]>('/favorites/ids'),

  add: (productId: string) =>
    apiFetch<FavoriteToggleResult>('/favorites/' + productId, { method: 'POST' }),

  remove: (productId: string) =>
    apiFetch<FavoriteToggleResult>('/favorites/' + productId, { method: 'DELETE' }),
};

/** Both endpoints answer with the resulting state, so one shape covers both. */
interface FavoriteToggleResult {
  productId: string;
  isFavorite: boolean;
}

interface ToggleContext {
  previous: string[] | undefined;
}

function useIsCustomer(): boolean {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  return status === 'authenticated' && role === 'CUSTOMER';
}

export function useFavorites(page = 1) {
  const enabled = useIsCustomer();

  return useQuery({
    queryKey: favoriteKeys.list(page),
    queryFn: () => favoritesApi.list(page),
    enabled,
  });
}

/**
 * The favourited product ids, fetched once per session.
 *
 * A product grid renders dozens of hearts; asking per card would be a request
 * per product. One small array answers them all, and it is the value the
 * optimistic toggle below updates.
 */
export function useFavoriteIds(): Set<string> {
  const enabled = useIsCustomer();

  const { data } = useQuery({
    queryKey: favoriteKeys.ids(),
    queryFn: favoritesApi.ids,
    enabled,
    staleTime: 60_000,
  });

  // Memoised because every card in a grid calls this hook: without it, a
  // 20-product page would rebuild 20 Sets on each render.
  return useMemo(() => new Set(data ?? []), [data]);
}

/**
 * Toggling a favourite is optimistic: the heart fills instantly and rolls back
 * if the request fails. Anything slower feels broken on a phone connection.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ productId, isFavorite }: { productId: string; isFavorite: boolean }) =>
      isFavorite ? favoritesApi.remove(productId) : favoritesApi.add(productId),

    onMutate: async ({ productId, isFavorite }): Promise<ToggleContext> => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.ids() });
      const previous = queryClient.getQueryData<string[]>(favoriteKeys.ids());

      queryClient.setQueryData<string[]>(favoriteKeys.ids(), (current = []) =>
        isFavorite ? current.filter((id) => id !== productId) : [...current, productId],
      );

      return { previous };
    },

    onError: (error: unknown, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.ids(), context.previous);
      }

      toast({
        title: tNow('toast.favouritesFailed'),
        description:
          error instanceof ApiError ? describeError(error) : tNow('errors.checkConnection'),
        variant: 'error',
      });
    },

    onSettled: () => {
      // The saved-items list may now be a page short or long, so it refetches;
      // the id set is already correct from the optimistic update.
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}
