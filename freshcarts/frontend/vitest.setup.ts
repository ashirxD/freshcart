import '@testing-library/jest-dom/vitest';
import { notifyManager } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { useAuthStore } from '@/store/auth.store';

/**
 * React Query batches cache notifications through a microtask, which lands
 * outside React Testing Library's `act` window and produces a stream of
 * "not wrapped in act(...)" warnings that bury real failures.
 *
 * Running the scheduler synchronously puts those updates back inside act. It
 * changes only when React is told about a change, never what changed, so tests
 * still exercise the same behaviour the browser gets.
 */
notifyManager.setScheduler((callback) => callback());

// jsdom implements neither, and components that use them must not crash a test.
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * jsdom implements neither half of the object-URL API, which the grocery-list
 * scanner uses to preview a chosen photo without uploading it.
 *
 * Shimmed as a matched pair — create and revoke — so a component that fails to
 * revoke is still a real leak rather than a silent no-op, and a test could
 * assert on it if one ever needed to.
 */
if (typeof URL.createObjectURL !== 'function') {
  let sequence = 0;
  URL.createObjectURL = () => 'blob:test/' + (sequence += 1);
  URL.revokeObjectURL = () => {};
}

/**
 * Teardown, in the order that matters.
 *
 * `cleanup()` first: unmounting before the session and global stubs are reset
 * is what stops a still-mounted component from reacting to those resets outside
 * React's `act` window — which surfaces as a stream of "not wrapped in act"
 * warnings that hide real failures.
 */
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, accessToken: null, status: 'loading' });
  vi.unstubAllGlobals();
});
