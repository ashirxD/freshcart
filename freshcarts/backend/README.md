# FreshCarts API

NestJS + MongoDB. The authoritative business layer: prices, totals, delivery
fees, stock, order status and roles are decided here and nowhere else.

See [`API.md`](API.md) for every endpoint, and the [root README](../README.md)
for setup, seeding and deployment.

```bash
cp .env.example .env      # then generate real JWT secrets
npm install
npm run start:dev         # http://localhost:4000/api/v1
npm run seed              # development catalogue + demo accounts
```

Scripts: `build`, `start:prod`, `test`, `lint`, `lint:check`, `seed`, `seed:fresh`.

## Module map

Dependency order runs top to bottom; nothing below depends on anything above it.

| Layer | Modules | Owns |
| ----- | ------- | ---- |
| Platform | `settings`, `audit` | Business configuration and the administrative trail. Both `@Global`, both dependency-free |
| Identity | `auth`, `users`, `stores` | Accounts, tokens, and the store scope everything else hangs off |
| Catalogue | `categories`, `inventory`, `products` | What is sold, and how much of it there is |
| Shopper | `cart`, `favorites`, `addresses` | A customer's own data |
| Purchase | `delivery`, `payments`, `checkout`, `orders` | Distance and fee, method, validation, and the commitment |
| AI | `grocery-scan` | OCR orchestration and product matching. Owns no data |
| Operations | `substitutions`, `store-manager`, `admin` | Store and platform surfaces. Own almost no schema |

`store-manager` and `admin` sit at the top and delegate every read and write to
the domain service that already owns it. What they contribute is scope
resolution, an API surface, and one genuine cross-domain aggregation each.

## The rules this codebase is built on

**Controllers are thin.** They map HTTP to a service call and shape the
response. Every rule lives in a service.

**Authentication is on by default.** The global `JwtAuthGuard` closes every
route; `@Public()` is the only way out, and it is used deliberately.

**Authorization comes from the principal, never the request.** A role or a
`storeId` in a body, query or path is untrusted input. The JWT strategy re-reads
both from the database on every request, so a demotion takes effect immediately.

**Ownership goes in the query filter, not a comparison afterwards.** "Find the
order with this id AND this userId" cannot leak; "find the order, then check its
owner" can, the first time somebody forgets the second half.

**Order status moves in exactly one place.** `OrdersService.changeStatus`
validates every transition against the machine for that order's fulfilment
method, and owns the side effects that must accompany one. No endpoint anywhere
assigns a status directly — including the admin override, which is a
mandatory-reason wrapper around the same method.

**Stock is taken with a single guarded update.** The condition lives in the
update filter. Never read stock, check it, then write it — that races and
oversells.

**Orders snapshot everything they display.** Item names, prices, the address,
the measured distance, the fee. A historical order never reads through to a live
Product, Address or pricing rule.

**Money is whole rupees, as integers.** `subtotal + deliveryFee - discount ===
total` is an exact identity, and the order schema verifies it on every save.

**Business failures carry a stable `ErrorCode`** beside a message written for a
shopper. Clients branch on the code; the message may be reworded freely.

**Audit rows record who did what to which resource, when.** Never a request
body, never a credential — `AuditService.sanitiseMetadata` is the backstop.

## Transactions

Order creation writes to inventory, orders and payments together. `TransactionRunner`
probes for replica-set support at runtime: on a replica set it is a real
transaction, on a standalone `mongod` it falls back to a compensating saga where
each write is individually atomic and undone in reverse on failure.

The fallback's one weakness is a process crash between a write and its
compensation, which over-counts stock rather than overselling it. **Production
should run a replica set.**
