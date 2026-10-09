'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` while React is hydrating server HTML, `true` from the first render
 * after that and for every component that mounts later (client navigation).
 *
 * This is `useSyncExternalStore`'s server snapshot doing its intended job:
 * during hydration React renders with `getServerSnapshot`, so a component can
 * produce exactly the markup the server produced, and then re-render once with
 * the real value. There is no effect and no flash for components that were
 * never server-rendered.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
