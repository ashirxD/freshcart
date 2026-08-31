'use client';

import { useCallback, useRef } from 'react';

/**
 * Generates a key with the best source available.
 *
 * `crypto.randomUUID` is present in every browser this app supports, but it is
 * absent in some non-secure contexts and in older test environments — and a
 * checkout that throws because a UUID could not be minted would be a far worse
 * failure than a slightly weaker random string.
 */
function generateKey(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return 'fc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

/**
 * The client half of duplicate-order protection.
 *
 * One key per checkout *attempt*. It is minted lazily on the first "Place
 * order" tap and then held: a double-tap, a retry after a timeout, and a retry
 * after a network drop all send the same key, and the server answers the second
 * and third with the order the first created rather than making new ones.
 *
 * It lives in a ref rather than state on purpose — changing it must never
 * re-render the review screen, and it must survive re-renders caused by
 * anything else on that screen.
 *
 * `reset` is called after a failure the shopper has fixed (a line went out of
 * stock, they changed the cart), because that is a genuinely different attempt
 * and should not be answered with a replay of the old one.
 */
export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);

  const current = useCallback(() => {
    keyRef.current ??= generateKey();
    return keyRef.current;
  }, []);

  const reset = useCallback(() => {
    keyRef.current = null;
  }, []);

  return { current, reset };
}
