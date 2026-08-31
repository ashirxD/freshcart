'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { cartKeys } from '@/features/cart/cart.hooks';
import { orderKeys } from '@/features/orders/orders.hooks';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { Cart } from '@/types/cart';
import type {
  CheckoutPreview,
  CheckoutPreviewInput,
  CreateOrderInput,
  OrderDetail,
  PaymentMethodOption,
} from '@/types/order';

export const checkoutKeys = {
  all: ['checkout'] as const,
  preview: (input: CheckoutPreviewInput) => [...checkoutKeys.all, 'preview', input] as const,
  paymentMethods: () => [...checkoutKeys.all, 'payment-methods'] as const,
};

const checkoutApi = {
  preview: (input: CheckoutPreviewInput) =>
    apiFetch<CheckoutPreview>('/checkout/preview', { method: 'POST', body: input }),

  paymentMethods: () => apiFetch<PaymentMethodOption[]>('/payments/methods'),

  acceptPrices: () => apiFetch<Cart>('/cart/accept-prices', { method: 'POST' }),

  createOrder: (input: { values: CreateOrderInput; idempotencyKey: string }) =>
    apiFetch<OrderDetail>('/orders', {
      method: 'POST',
      body: input.values,
      // The header that makes a retry safe. See useIdempotencyKey below.
      headers: { 'Idempotency-Key': input.idempotencyKey },
    }),
};

/**
 * The server-authoritative checkout preview.
 *
 * A query rather than a mutation, deliberately: it is a read whose answer
 * depends on the shopper's current choices, and modelling it as a query gives
 * automatic refetching when those choices change and a single in-flight request
 * when they change twice quickly.
 *
 * ROUTING COST CONTROL (§59)
 * The query key is the *choice*, not the form state: fulfilment method, address
 * id, payment method. Typing in an address form changes none of those, so no
 * routing request is made while the shopper types. A preview is fetched when
 * they pick an address, switch to delivery, or land on the review step — and
 * the result is cached against that exact combination, so flipping back and
 * forth between two saved addresses does not re-charge for routing.
 *
 * `staleTime: 0` because this is per-shopper financial data. It is cached
 * within a screen so the same request is not issued twice in one render pass,
 * and refetched whenever the shopper returns to it.
 */
export function useCheckoutPreview(input: CheckoutPreviewInput | null) {
  const status = useAuthStore((state) => state.status);

  const isReady =
    status === 'authenticated' &&
    input !== null &&
    // Delivery cannot be priced without an address, and asking anyway would
    // spend a routing request to be told what the client already knows.
    (input.fulfillmentMethod === 'PICKUP' || Boolean(input.addressId));

  return useQuery({
    queryKey: checkoutKeys.preview(input ?? { fulfillmentMethod: 'PICKUP' }),
    queryFn: () => checkoutApi.preview(input as CheckoutPreviewInput),
    enabled: isReady,
    staleTime: 0,
    gcTime: 0,
    // A stale total must never flash on screen while a fresh one loads.
    placeholderData: undefined,
    retry: false,
  });
}

/** Payment methods the API will actually accept. Never derived client-side. */
export function usePaymentMethods() {
  const status = useAuthStore((state) => state.status);

  return useQuery({
    queryKey: checkoutKeys.paymentMethods(),
    queryFn: checkoutApi.paymentMethods,
    enabled: status === 'authenticated',
    // Configuration, not shopper data: safe to hold for a session.
    staleTime: 10 * 60_000,
  });
}

/**
 * "I have seen the new prices, continue."
 *
 * Sends no prices — it asks the server to copy its own current catalogue prices
 * onto the cart's agreed-price field. There is no body a client could use to
 * influence what it is charged.
 */
export function useAcceptPriceChanges() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: checkoutApi.acceptPrices,
    onSuccess: (cart) => {
      queryClient.setQueryData(cartKeys.detail(), cart);
      // The preview was refused because of those prices; it must be re-asked.
      void queryClient.invalidateQueries({ queryKey: checkoutKeys.all });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Could not update your cart',
        description: error instanceof ApiError ? error.message : 'Please try again.',
        variant: 'error',
      });
    },
  });
}

/**
 * Places the order.
 *
 * Invalidates the cart (lines were removed), the order list (a new order
 * exists) and the checkout preview (the basket it described is gone). Not
 * patched by hand — a placed order changes too much for a hand-written cache
 * update to stay correct.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkoutApi.createOrder,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: checkoutKeys.all });
    },
    // Errors are rendered inline on the review step, where the shopper can act
    // on them, rather than in a toast that disappears.
  });
}
