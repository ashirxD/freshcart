# FreshCarts web client

Next.js App Router + TypeScript. Mobile-first for shoppers, with a deliberate
desktop adaptation for the two staff surfaces.

See the [root README](../README.md) for setup and the full route list.

```bash
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

Scripts: `build`, `start`, `lint`, `typecheck`, `test`, `format`.

## Structure

```
src/
├── app/
│   ├── (customer)/       the storefront
│   ├── (auth)/           login and register
│   ├── (store-manager)/  the store console
│   ├── (admin)/          the control centre
│   ├── not-found.tsx     the root 404
│   └── global-error.tsx  last resort — a failure in the root layout itself
├── components/           UI kit, then feature components by domain
├── features/<domain>/    .api.ts (transport) + .hooks.ts (TanStack Query)
├── lib/                  API client, formatting, validation schemas
├── store/                Zustand — client state only
└── types/                mirrors of the API contracts
```

Each route group has its own `error.tsx` and `loading.tsx`, so a failure in the
back office leaves the storefront running and vice versa.

## State: which tool, and why

**TanStack Query owns all server state** — products, categories, cart, orders,
inventory, admin data. Anything that lives in the database is fetched, cached and
invalidated here, never copied into a store.

**Zustand owns client state only**, and there are exactly two stores: the auth
session (the in-memory access token and the current user) and toasts. Putting
server data in Zustand would create a second copy that goes stale silently, which
is the failure this split exists to prevent.

Query keys are namespaced (`['admin', ...]`, `['catalog', ...]`), so a write
invalidates a whole area in one call. Every back-office mutation invalidates both
the admin and the catalogue caches — an admin editing a product must not keep
seeing the old one on the customer side of the same session.

## Conventions

**The server is the authority.** Prices, totals, delivery fees, availability and
the next legal order status all arrive computed. This client never derives them.
A button for a transition the API would refuse is not rendered, because the list
of transitions comes from the server.

**Client-side validation is a courtesy, not a control.** Every form rule here is
also enforced by the API, which is the one that decides.

**Design tokens are declared once**, in `app/globals.css`, and consumed as
Tailwind utilities. No hex codes or pixel values in components.

**A label is mandatory on every field.** Placeholder-only inputs disappear the
moment somebody starts typing, which is worst for exactly the shoppers this app
is built for.

**Status is never colour alone.** Every badge and tile pairs its colour with a
word and usually an icon, and interactive state uses `aria-pressed` or
`aria-current` rather than styling alone.

**Touch targets are at least 48px.** The `min-h-touch` utility exists for this.

**Internal enums stay internal.** `PREPARING` is a database value; "Your order is
being prepared" is what a person reads.

**Server Components by default.** `'use client'` appears only where a component
genuinely needs state, an effect or an event handler — route `page.tsx` files
stay server components and hand off to a client screen.

## Testing

```bash
npm test
```

Vitest + Testing Library. Screens are rendered inside the providers they actually
run under, with `fetch` stubbed per route, so a test exercises the data layer
rather than mocking around it.

Teardown lives in `vitest.setup.ts` and the order matters: unmount, then clear the
session, then drop the stubs. Resetting the session while components are still
mounted makes them react outside React's `act` window, which produces warning
noise that buries real failures. Test files should not repeat that teardown.
