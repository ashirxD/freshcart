import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Vitest rather than Jest: this is a Vite-flavoured toolchain already, ESM
 * throughout, and Vitest reads the `@/*` path alias straight from tsconfig
 * instead of restating it in a second place that can drift.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    /**
     * The checkout-flow tests drive four sequential user interactions, each
     * awaiting a stubbed request and a re-render. That comfortably fits the 5s
     * default on an idle machine and does not on a busy one — a CI box running
     * a build alongside it, for instance. The generous ceiling removes a source
     * of flakiness without hiding a slow test: a genuine hang still fails.
     */
    testTimeout: 15_000,
    /**
     * The app validates NEXT_PUBLIC_API_URL at import time and refuses to run
     * without it. Next injects it from .env.local; under Vitest nothing does,
     * so it is supplied here. The value is never called — every test stubs
     * `fetch` — but the URL must be well-formed for the schema to pass.
     */
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
    },
  },
});
