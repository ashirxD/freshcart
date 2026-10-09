'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@/lib/api/query-hooks';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { tNow, type TranslationKey } from '@/i18n';
import { describeError } from '@/lib/api/error-copy';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { Cart } from '@/types/cart';

export const cartKeys = {
  all: ['cart'] as const,
  detail: () => [...cartKeys.all, 'detail'] as const,
};

const cartApi = {
  get: () => apiFetch<Cart>('/cart'),

  addItem: (input: { productId: string; quantity: number }) =>
    apiFetch<Cart>('/cart/items', { method: 'POST', body: input }),

  updateItem: (input: { productId: string; quantity: number }) =>
    apiFetch<Cart>('/cart/items/' + input.productId, {
      method: 'PATCH',
      body: { quantity: input.quantity },
    }),

  removeItem: (productId: string) =>
    apiFetch<Cart>('/cart/items/' + productId, { method: 'DELETE' }),

  clear: () => apiFetch<Cart>('/cart', { method: 'DELETE' }),
};

/**
 * The cart is only fetched for a signed-in customer.
 *
 * Guarding on the session rather than letting the request 401 keeps a browsing
 * visitor from generating a failed request on every page — and keeps the API
 * client's refresh-then-retry path for cases that are actually recoverable.
 */
export function useCart() {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  const enabled = status === 'authenticated' && role === 'CUSTOMER';

  return useQuery({
    queryKey: cartKeys.detail(),
    queryFn: cartApi.get,
    enabled,
    // The cart is the one thing a shopper expects to be exactly right.
    staleTime: 0,
  });
}

/** Total units in the cart, for the navigation badge. */
export function useCartCount(): number {
  const { data } = useCart();
  return data?.totalQuantity ?? 0;
}

/**
 * Every mutation returns the whole recalculated cart, so the cache is *set*
 * from the response rather than invalidated. That avoids a second round trip
 * and guarantees the totals on screen are the ones the server just computed.
 */
function useCartMutation<TInput>(
  mutationFn: (input: TInput) => Promise<Cart>,
  options: { successMessage?: (input: TInput) => TranslationKey; errorTitle: TranslationKey } = {
    errorTitle: 'toast.basketUpdateFailed',
  },
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (cart, input) => {
      queryClient.setQueryData(cartKeys.detail(), cart);

      const message = options.successMessage?.(input);
      if (message) toast({ title: tNow(message), variant: 'success' });
    },
    onError: (error: unknown) => {
      toast({
        title: tNow(options.errorTitle),
        description:
          error instanceof ApiError ? describeError(error) : tNow('errors.checkConnection'),
        variant: 'error',
      });
    },
  });
}

export function useAddToCart() {
  return useCartMutation(cartApi.addItem, {
    successMessage: () => 'toast.addedToBasket',
    errorTitle: 'toast.addItemFailed',
  });
}

export function useUpdateCartItem() {
  return useCartMutation(cartApi.updateItem, { errorTitle: 'toast.changeQuantityFailed' });
}

export function useRemoveCartItem() {
  return useCartMutation(cartApi.removeItem, {
    successMessage: () => 'toast.removedFromBasket',
    errorTitle: 'toast.removeItemFailed',
  });
}

export function useClearCart() {
  return useCartMutation(cartApi.clear, {
    successMessage: () => 'toast.basketEmptied',
    errorTitle: 'toast.clearFailed',
  });
}
