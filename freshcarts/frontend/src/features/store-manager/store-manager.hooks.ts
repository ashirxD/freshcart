'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { StoreInventoryQuery, StoreOrderQuery } from '@/types/store-manager';
import { storeManagerApi } from './store-manager.api';

export const storeKeys = {
  all: ['store-manager'] as const,
  dashboard: () => [...storeKeys.all, 'dashboard'] as const,
  orders: (query: StoreOrderQuery) => [...storeKeys.all, 'orders', query] as const,
  order: (id: string) => [...storeKeys.all, 'order', id] as const,
  inventory: (query: StoreInventoryQuery) => [...storeKeys.all, 'inventory', query] as const,
  inventoryHistory: (productId: string) =>
    [...storeKeys.all, 'inventory-history', productId] as const,
  products: (query: object) => [...storeKeys.all, 'products', query] as const,
};

/**
 * Whether the signed-in principal is store staff.
 *
 * Guards the queries so a customer's session never fires a request that would
 * 403 — and so the console's skeletons do not flash before the access screen.
 * This is a UX guard only; the API enforces the real one.
 */
function useIsStoreManager(): boolean {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  return status === 'authenticated' && role === 'STORE_MANAGER';
}

/**
 * How often the console re-reads server state.
 *
 * An operations screen is left open on a counter all day while orders arrive
 * from elsewhere, so the queue and the dashboard poll. Thirty seconds is a
 * compromise: frequent enough that a new order is noticed, infrequent enough
 * that a shop on a phone connection is not paying for it every second.
 */
const OPERATIONS_REFETCH_MS = 30_000;

export function useStoreDashboard() {
  const enabled = useIsStoreManager();

  return useQuery({
    queryKey: storeKeys.dashboard(),
    queryFn: storeManagerApi.dashboard,
    enabled,
    staleTime: 0,
    refetchInterval: enabled ? OPERATIONS_REFETCH_MS : false,
  });
}

export function useStoreOrders(query: StoreOrderQuery) {
  const enabled = useIsStoreManager();

  return useQuery({
    queryKey: storeKeys.orders(query),
    queryFn: () => storeManagerApi.orders(query),
    enabled,
    staleTime: 0,
    refetchInterval: enabled ? OPERATIONS_REFETCH_MS : false,
    // Keeps the previous page on screen while the next one loads, so paging and
    // filtering do not blank the table under someone's hands.
    placeholderData: (previous) => previous,
  });
}

export function useStoreOrder(id: string) {
  const enabled = useIsStoreManager();

  return useQuery({
    queryKey: storeKeys.order(id),
    queryFn: () => storeManagerApi.order(id),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}

export function useStoreInventory(query: StoreInventoryQuery) {
  const enabled = useIsStoreManager();

  return useQuery({
    queryKey: storeKeys.inventory(query),
    queryFn: () => storeManagerApi.inventory(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useStockHistory(productId: string | null) {
  return useQuery({
    queryKey: storeKeys.inventoryHistory(productId ?? ''),
    queryFn: () => storeManagerApi.inventoryHistory(productId as string),
    enabled: Boolean(productId),
  });
}

export function useStoreProducts(query: { search?: string; page?: number; limit?: number }) {
  const enabled = useIsStoreManager();

  return useQuery({
    queryKey: storeKeys.products(query),
    queryFn: () => storeManagerApi.products(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/**
 * Shared plumbing for every operations write.
 *
 * NO OPTIMISTIC UPDATES. §46 is explicit and the reason is worth restating: an
 * order status is a business fact the shopper is watching too. Showing
 * "Delivered" before the server agreed means that if the request fails, a member
 * of staff has been told a handover was recorded when it was not — and the next
 * thing they do is walk away. So every mutation waits, and the response (which
 * is the recalculated order) is written into the cache.
 */
function useOperationsMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  options: {
    successMessage?: string | ((result: TResult) => string);
    errorTitle: string;
    onDone?: (result: TResult) => void;
  },
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      // Every count on the dashboard and every row in the queue may have moved.
      void queryClient.invalidateQueries({ queryKey: storeKeys.all });

      const message =
        typeof options.successMessage === 'function'
          ? options.successMessage(result)
          : options.successMessage;

      if (message) toast({ title: message, variant: 'success' });
      options.onDone?.(result);
    },
    onError: (error: unknown) => {
      toast({
        title: options.errorTitle,
        description: describe(error),
        variant: 'error',
      });
    },
  });
}

/**
 * Turns a failure into something a member of staff can act on.
 *
 * The two cases that matter operationally get their own wording: a stale
 * transition means somebody else already moved the order, and a 403/404 on a
 * store-scoped resource means it is not this store's to touch. Everything else
 * falls back to the server's own message, which is written for a person.
 */
function describe(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Please check your connection and try again.';
  }

  if (error.code === 'INVALID_STATUS_TRANSITION') {
    return 'This order has already been updated by someone else. Reload to see where it is now.';
  }

  if (error.status === 403) {
    return 'You no longer have access to this store.';
  }

  if (error.status === 404) {
    return 'That order is no longer available in this store.';
  }

  return error.message;
}

export function useUpdateOrderStatus(onDone?: () => void) {
  return useOperationsMutation(storeManagerApi.updateOrderStatus, {
    successMessage: (order) => 'Order ' + order.orderNumber + ' is now ' + order.statusLabel,
    errorTitle: 'Could not update this order',
    onDone,
  });
}

export function useRejectOrder(onDone?: () => void) {
  return useOperationsMutation(storeManagerApi.rejectOrder, {
    successMessage: (order) => 'Order ' + order.orderNumber + ' was rejected',
    errorTitle: 'Could not reject this order',
    onDone,
  });
}

export function useProposeSubstitution(onDone?: () => void) {
  return useOperationsMutation(storeManagerApi.proposeSubstitution, {
    successMessage: 'Replacement sent to the customer',
    errorTitle: 'Could not propose that replacement',
    onDone,
  });
}

export function useCancelSubstitution() {
  return useOperationsMutation(storeManagerApi.cancelSubstitution, {
    successMessage: 'Replacement withdrawn',
    errorTitle: 'Could not withdraw the replacement',
  });
}

export function useUpdateStock(onDone?: () => void) {
  return useOperationsMutation(storeManagerApi.updateInventory, {
    successMessage: 'Stock updated',
    errorTitle: 'Could not update the stock',
    onDone,
  });
}

export function useSetProductAvailability() {
  return useOperationsMutation(storeManagerApi.setProductAvailability, {
    successMessage: (product) =>
      product.isActive ? product.name + ' is back on sale' : product.name + ' is off sale',
    errorTitle: 'Could not change availability',
  });
}
