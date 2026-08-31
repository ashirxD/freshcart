'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { cartKeys } from '@/features/cart/cart.hooks';
import { useAuthStore } from '@/store/auth.store';
import type { ConfirmScanInput, ScanConfirmation, ScanResult } from '@/types/scan';

export const scanKeys = {
  all: ['scan'] as const,
  availability: () => [...scanKeys.all, 'availability'] as const,
};

/**
 * Uploads the image as multipart form data.
 *
 * `apiFetch` is bypassed for this one call because it JSON-encodes every body,
 * and a photo is not JSON. Everything else it provides — the bearer token, the
 * refresh cookie, the normalised error — is reproduced here rather than
 * skipped; the difference is only the encoding.
 *
 * Deliberately no Content-Type header: the browser sets it, including the
 * multipart boundary, and setting it by hand produces a body the server cannot
 * parse.
 */
async function uploadScan(file: File): Promise<ScanResult> {
  const form = new FormData();
  form.append('image', file);

  return apiFetch<ScanResult>('/ocr/grocery-list', { method: 'POST', body: form });
}

/**
 * Whether the scanner can be offered at all.
 *
 * Asked before the entry point is shown, so a shopper is never invited to
 * photograph their list and only then told we cannot read it (§37). A failure
 * here is treated as "unavailable" rather than surfaced as an error — the
 * feature is simply absent, and the rest of the app is unaffected.
 */
export function useScanAvailability() {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: scanKeys.availability(),
    queryFn: () => apiFetch<{ available: boolean }>('/ocr/availability'),
    enabled: status === 'authenticated' && role === 'CUSTOMER',
    // The AI service does not come and go minute by minute, and this runs on
    // the home screen — a fresh probe on every visit would be wasted.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Reads a photo of a grocery list.
 *
 * A mutation rather than a query: it is expensive, it is triggered by an
 * explicit action, and it must never be retried automatically — §41's whole
 * point is that one shopper cannot submit image after image.
 */
export function useScanGroceryList() {
  return useMutation({
    mutationFn: uploadScan,
    retry: false,
  });
}

/**
 * Adds the confirmed products to the cart.
 *
 * The response carries the recalculated cart, so it is written straight into
 * the cache: the badge updates immediately, from the server's own figures,
 * with no second request and no second source of cart state (§63).
 */
export function useConfirmScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConfirmScanInput) =>
      apiFetch<ScanConfirmation>('/ocr/grocery-list/confirm', { method: 'POST', body: input }),

    onSuccess: (result) => {
      queryClient.setQueryData(cartKeys.detail(), result.cart);
    },

    retry: false,
  });
}
