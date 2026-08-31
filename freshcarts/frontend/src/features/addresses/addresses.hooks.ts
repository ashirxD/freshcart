'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { Address, AddressInput } from '@/types/address';

export const addressKeys = {
  all: ['addresses'] as const,
  list: () => [...addressKeys.all, 'list'] as const,
};

/** Transport only. Caching, retries and messaging belong to the hooks below. */
const addressesApi = {
  list: () => apiFetch<Address[]>('/addresses'),

  create: (input: AddressInput) => apiFetch<Address>('/addresses', { method: 'POST', body: input }),

  update: (input: { id: string; values: Partial<AddressInput> }) =>
    apiFetch<Address>('/addresses/' + input.id, { method: 'PATCH', body: input.values }),

  setDefault: (id: string) => apiFetch<Address>('/addresses/' + id + '/default', { method: 'PATCH' }),

  remove: (id: string) =>
    apiFetch<{ deleted: true; id: string }>('/addresses/' + id, { method: 'DELETE' }),
};

/**
 * The shopper's address book.
 *
 * Only fetched for a signed-in customer: letting the request 401 on every page
 * would burn the API client's refresh-then-retry path on a case that is not
 * actually recoverable.
 */
export function useAddresses() {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: addressKeys.list(),
    queryFn: addressesApi.list,
    enabled: status === 'authenticated' && role === 'CUSTOMER',
  });
}

/**
 * One mutation factory for all five writes.
 *
 * Every one of them can change which address is the default — creating the
 * first, promoting one, deleting the current one — so they all invalidate the
 * same list rather than each patching the cache with its own idea of the new
 * state. One round trip is cheaper than the class of bug where two addresses
 * both look default on screen.
 */
function useAddressMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  options: { successMessage?: string; errorTitle: string },
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: addressKeys.all });
      if (options.successMessage) toast({ title: options.successMessage, variant: 'success' });
    },
    onError: (error: unknown) => {
      toast({
        title: options.errorTitle,
        description:
          error instanceof ApiError ? error.message : 'Please check your connection and try again.',
        variant: 'error',
      });
    },
  });
}

export function useCreateAddress() {
  return useAddressMutation(addressesApi.create, {
    successMessage: 'Address saved',
    errorTitle: 'Could not save this address',
  });
}

export function useUpdateAddress() {
  return useAddressMutation(addressesApi.update, {
    successMessage: 'Address updated',
    errorTitle: 'Could not update this address',
  });
}

export function useSetDefaultAddress() {
  return useAddressMutation(addressesApi.setDefault, {
    errorTitle: 'Could not set your default address',
  });
}

export function useDeleteAddress() {
  return useAddressMutation(addressesApi.remove, {
    successMessage: 'Address removed',
    errorTitle: 'Could not remove this address',
  });
}
