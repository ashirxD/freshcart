'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@/lib/api/query-hooks';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { ltrNow, tNow } from '@/i18n';
import { describeError } from '@/lib/api/error-copy';
import { toQueryString } from '@/features/catalog/catalog.api';
import { cartKeys } from '@/features/cart/cart.hooks';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { Paginated } from '@/types/catalog';
import type { OrderDetail, OrderStatus, OrderSummary } from '@/types/order';

export interface OrderQuery {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (query: OrderQuery) => [...orderKeys.lists(), query] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

const ordersApi = {
  list: (query: OrderQuery) =>
    apiFetch<Paginated<OrderSummary>>('/orders' + toQueryString({ ...query })),

  detail: (id: string) => apiFetch<OrderDetail>('/orders/' + id),

  cancel: (input: { id: string; reason?: string }) =>
    apiFetch<OrderDetail>('/orders/' + input.id + '/cancel', {
      method: 'POST',
      body: { reason: input.reason },
    }),
};

/**
 * How often a live order is re-read.
 *
 * An order that is still moving is polled while the shopper is looking at it,
 * because the store advances it from another device and a stale "Preparing" on
 * a tracking screen is exactly the thing that screen exists to prevent. A
 * finished order never changes again, so it is never polled.
 */
const LIVE_ORDER_REFETCH_MS = 60_000;

const FINISHED_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REJECTED', 'FAILED'];

export function useOrders(query: OrderQuery = {}) {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () => ordersApi.list(query),
    enabled: status === 'authenticated' && role === 'CUSTOMER',
  });
}

export function useOrder(id: string) {
  const status = useAuthStore((state) => state.status);

  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.detail(id),
    enabled: status === 'authenticated' && Boolean(id),
    // An order's status is the one thing on this screen that moves without the
    // shopper doing anything, so it is never served stale.
    staleTime: 0,
    refetchInterval: (query) => {
      const order = query.state.data as OrderDetail | undefined;
      if (!order || FINISHED_STATUSES.includes(order.status)) return false;
      return LIVE_ORDER_REFETCH_MS;
    },
  });
}

/**
 * Cancels an order.
 *
 * The response is the updated order, so the detail cache is set from it rather
 * than invalidated — the shopper sees the new status without a second round
 * trip. The list and the cart are invalidated because cancelling returns stock,
 * which changes what the catalogue and cart report.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ordersApi.cancel,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });

      toast({
        title: tNow('toast.orderCancelled'),
        description: tNow('toast.orderCancelledBody', { orderNumber: ltrNow(order.orderNumber) }),
        variant: 'success',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: tNow('toast.orderCancelFailed'),
        description:
          error instanceof ApiError ? describeError(error) : tNow('errors.checkConnection'),
        variant: 'error',
      });
    },
  });
}
