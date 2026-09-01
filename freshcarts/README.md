# FreshCarts

Grocery commerce platform for Pakistani shoppers. Mobile-first customer web app with
a deliberate desktop adaptation, backed by a role-aware API.

- `backend/` — NestJS + MongoDB (Mongoose) API
- `frontend/` — Next.js App Router customer web app
- `ai-service/` — Python + FastAPI OCR service behind "Scan Grocery List"

Roles: `CUSTOMER`, `STORE_MANAGER`, `ADMIN` — one API and one RBAC system for all three.

**API reference:** [`backend/API.md`](backend/API.md) — every endpoint, its role, its
request, its response and its errors.

---

## Architecture

```
                      Browser (Next.js)
                             │  HTTPS, Bearer access token + httpOnly refresh cookie
                             ▼
                  NestJS API  ──────────────►  MongoDB
                 (the business layer)          (replica set in production)
                             │
                             │  private network only
                             ▼
                   FastAPI AI service  ──►  Tesseract OCR
```

**NestJS is the authoritative business layer.** Prices, totals, delivery fees,
stock, order status and roles are decided there and nowhere else. Every one of
those is recomputed server-side from the database, whatever a client sends.

**Python is the AI/OCR layer and nothing more.** It never touches MongoDB, never
sees a price, and cannot express a product id. It contributes normalisation
("doodh" is milk) and returns intelligence, never decisions. The browser never
talks to it — the API is its only caller — so it stays on a private address.

**Business logic never moves into Python, and the AI service is never made a
second source of truth.** When it is down, only the scanner degrades.

### Repository structure

```
freshcarts/
├── backend/                     NestJS + Mongoose
│   ├── API.md                   the endpoint reference
│   └── src/
│       ├── common/              config, guards, errors, pipes, idempotency, transactions
│       ├── database/seeds/      development seed data
│       └── modules/
│           ├── auth/ users/ stores/          identity and scope
│           ├── categories/ products/ inventory/   the catalogue
│           ├── cart/ favorites/ addresses/        the shopper's own data
│           ├── delivery/ payments/ checkout/ orders/  the purchase flow
│           ├── grocery-scan/    OCR orchestration and product matching
│           ├── substitutions/ store-manager/  store operations
│           ├── settings/ audit/ admin/        platform administration
│           └── health/
├── frontend/                    Next.js App Router
│   └── src/
│       ├── app/(customer)/ (auth)/ (store-manager)/ (admin)/   route groups
│       ├── components/          UI kit and feature components
│       ├── features/            API transport + TanStack Query hooks, per domain
│       ├── lib/                 API client, formatting, validation schemas
│       └── store/               Zustand — client state only, never server state
└── ai-service/                  FastAPI + Tesseract
    └── app/                     api/ core/ ocr/ schemas/ services/
```

---

## Prerequisites

| Tool    | Version                          |
| ------- | -------------------------------- |
| Node.js | 20+ (developed on 22.12)         |
| npm     | 10+                              |
| MongoDB | 6+ running locally, or an Atlas cluster |
| Python  | 3.11+ — only for `ai-service/` |
| Tesseract | 5+ — only for `ai-service/`; see its README |

Python and Tesseract are optional. Without them the grocery-list scanner is
unavailable and hides itself; everything else works unchanged.

## Database setup

Pick one:

**Local MongoDB (Windows)** — install MongoDB Community Server, then confirm it is up:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

**Docker**

```bash
docker run -d --name freshcarts-mongo -p 27017:27017 -v freshcarts-data:/data/db mongo:7
```

**MongoDB Atlas** — create a free cluster and put the connection string in
`backend/.env` as `MONGODB_URI`.

The database and its collections are created automatically on first write. Indexes are
built from the schema definitions (`autoIndex` is on outside production).

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Generate real secrets before running (each must be 32+ characters, and the two must differ):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API boots on `http://localhost:4000`, with routes under `/api/v1` and health probes
at the unprefixed `/health` and `/health/ready`.

Seed the starting data — the store (FreshCarts Salamat Pura, Lahore), the
31-category tree, the delivery pricing bands, and the accounts:

```bash
npm run seed
```

`npm run seed:fresh` wipes the seeded collections first. Seeding is idempotent, writes
through the real services (so it passes the same validation as an admin would), and
refuses to run when `NODE_ENV=production`.

Accounts, read from `.env` and **for development only** — the seeder refuses to run
when `NODE_ENV=production`, so these exist in no other environment. Phone, email and
password all come from environment variables, so no real contact detail or usable
credential is committed to the repository:

| Role | Phone | Password | Set in `.env` |
| ---- | ----- | -------- | ------------- |
| ADMIN | `SEED_ADMIN_PHONE` | `SEED_ADMIN_PASSWORD` | + `SEED_ADMIN_EMAIL` |
| STORE_MANAGER | `SEED_MANAGER_PHONE` | `SEED_MANAGER_PASSWORD` | + `SEED_MANAGER_EMAIL` |
| CUSTOMER | `SEED_CUSTOMER_PHONE` | `SEED_CUSTOMER_PASSWORD` | — |

A phone may be typed as `03001234567`, `923001234567` or `+923001234567` — all three
normalise to the same account.

There is **one store**, and the store manager is bound to it. Everything downstream is
still keyed by `storeId`, so adding a second branch is data entry at `/admin/stores`
rather than a code change — but nothing is seeded speculatively.

**No products are seeded.** The catalogue is entered by hand at `/admin/products`, by
whoever knows what the shop actually stocks and what it charges. Seeding invented
products would put fabricated prices in front of a real shopper the moment the store
went live, and every one would have to be found and deleted first.

The category tree *is* seeded, because a product cannot be created without a category
to file it under — so the first product can be added straight after seeding, with no
setup step in between. Categories are editable at `/admin/categories`.

One consequence worth knowing: immediately after seeding the storefront is empty, and
the low-stock and out-of-stock states have nothing to demonstrate them until you add a
product and set its stock. That is a deliberate trade — an empty shop is honest, a shop
full of made-up prices is not.

Other scripts: `npm run build`, `npm test`, `npm run lint`, `npm run lint:check`.

### Configuration: two kinds, kept apart

**Environment configuration** lives in `.env` and is read only by
`src/common/config/configuration.ts`. It answers *where does this process find its
dependencies, and how is it deployed?* — `MONGODB_URI`, `JWT_ACCESS_SECRET`,
`AI_SERVICE_URL`, `CORS_ORIGINS`, `ROUTING_PROVIDER`. Changing one needs a redeploy.

**Business configuration** lives in the database and is edited at `/admin/settings` and
`/admin/delivery-pricing`. It answers *how does FreshCarts trade?* — the delivery
radius, the distance bands and their fees, the default low-stock threshold, the support
contact, and the platform-wide ordering switch. Changing one takes effect on the next
request, is attributable to an admin in the audit trail, and needs no deploy.

There is deliberately no `DELIVERY_MAX_DISTANCE_METERS` environment variable: a
delivery radius is a business decision, not a deployment one.

## Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Runs on `http://localhost:3000`. Other scripts: `npm run build`, `npm run typecheck`,
`npm run lint`, `npm test`.

**Customer** — `/`, `/categories`, `/categories/[slug]`, `/products/[slug]`, `/search`,
`/cart`, `/checkout`, `/checkout/confirmation/[id]`, `/orders`, `/orders/[id]`,
`/addresses`, `/favorites`, `/scan`.

**Store manager** (STORE_MANAGER) — `/store-manager`, `/store-manager/orders`,
`/store-manager/orders/[id]`, `/store-manager/inventory`, `/store-manager/products`.

**Admin** (ADMIN) — `/admin` (dashboard), `/admin/orders`, `/admin/orders/[id]`,
`/admin/products`, `/admin/categories`, `/admin/inventory`, `/admin/customers`,
`/admin/customers/[id]`, `/admin/store-managers`, `/admin/stores`,
`/admin/delivery-pricing`, `/admin/settings`.

The role gate on each area is a usability measure, not the security boundary —
every endpoint behind it is guarded server-side by role, so a visitor who renders
a back-office shell can still do nothing with it.

## AI service

```bash
cd ai-service
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env
python scripts/fetch_tessdata.py          # eng + urd language models
uvicorn app.main:app --reload --port 8000
```

Reads a photo of a grocery list and returns structured items. It never touches
MongoDB, never sees a price, and is not reachable from the browser — the NestJS
API is its only caller. See `ai-service/README.md` for the contract and for
installing Tesseract.

Point the API at it with `AI_SERVICE_URL`. When it is down, `GET /ocr/availability`
returns `false`, the scanner hides itself, and the rest of FreshCarts is unaffected.

## Deployment requirements

Two things the purchase flow needs beyond a database and a port.

**MongoDB transactions.** Order creation writes to inventory, orders and payments
together. On a replica set (or Atlas) that runs as a real transaction. On a standalone
`mongod` it falls back to a compensating-transaction saga: each write is individually
atomic and is undone in reverse if a later step fails. Support is probed at runtime, not
configured. The fallback's one weakness is a process crash between a write and its
compensation, which over-counts stock rather than overselling it — so **production
should run a replica set**. See `backend/src/common/database/transaction.runner.ts`.

**The AI service, on a private address.** It performs no authentication of its own —
it trusts that only the FreshCarts API can reach it — so exposing it publicly would
expose an unauthenticated OCR endpoint. `AI_SERVICE_URL` must point at a private
address in production, and it needs the `urd` language model (see
`ai-service/scripts/fetch_tessdata.py`) or Urdu lists come back as noise.

**A routing provider.** Delivery fees are charged against a measured road distance.
`ROUTING_PROVIDER=estimate` multiplies a straight line by a constant — fine for
development, dishonest on a receipt — so the application **refuses to boot in production**
with it set. Production needs `ROUTING_PROVIDER=osrm` and `ROUTING_OSRM_BASE_URL`
pointing at an OSRM-compatible service (self-hostable; no API key).

## Testing, linting and builds

Every gate, per service. All three suites pass with no skipped tests.

| | Backend | Frontend | AI service |
| --- | --- | --- | --- |
| Lint | `npm run lint:check` | `npm run lint` | — |
| Types | `npx tsc --noEmit` | `npm run typecheck` | Pydantic, at runtime |
| Tests | `npm test` | `npm test` | `pytest` |
| Build | `npm run build` | `npm run build` | `uvicorn app.main:app` |

```bash
cd backend    && npm run lint:check && npx tsc --noEmit && npm test && npm run build
cd frontend   && npm run lint && npm run typecheck && npm test && npm run build
cd ai-service && .venv/Scripts/python -m pytest
```

What the suites cover: auth and RBAC, store scope and cross-store isolation, the order
state machine on both fulfilment paths, idempotent order creation, guarded stock writes,
delivery pricing at its band boundaries, historical snapshots, the admin surface and its
override rules, audit-log sanitisation, OCR validation and failure handling, and the
customer, store and admin screens.

`backend/src/module-graph.spec.ts` is worth knowing about: it resolves the real
dependency graph for both root contexts with only the database stubbed. A missing module
import is invisible to `tsc` and to `nest build` — it surfaces at startup — and that test
is what turns it into a CI failure instead.

## Verifying it works

```bash
curl http://localhost:4000/health/ready
```

Register a customer:

```bash
curl -X POST http://localhost:4000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"Ayesha Khan\",\"phone\":\"03001234599\",\"password\":\"Secret123\"}"
```

Confirm RBAC rejects a customer on an admin route (expect `403`):

```bash
curl -i http://localhost:4000/api/v1/users -H "Authorization: Bearer <access-token>"
```

## Conventions

- Business logic lives in services. Controllers map HTTP to a service call and nothing else.
- The server is the sole authority on prices, totals, discounts, delivery fees and roles.
  Never trust those values from a client.
- Authentication is on by default: every route requires a valid token unless it carries
  `@Public()`.
- Design values are declared once in `frontend/src/app/globals.css` and consumed as
  Tailwind utilities. Do not hardcode hex codes or pixel values in components.
- Categories and products are always rendered from API data — never hardcoded in React.
- Money is whole Pakistani rupees stored as integers. Grocery pricing here has no paisa,
  so rupees *are* the smallest unit — which keeps every subtotal an exact integer sum.
- Availability (`IN_STOCK` / `LOW_STOCK` / `OUT_OF_STOCK`) is derived from the inventory
  row on read, never persisted, so it cannot go stale behind a quantity write.
- Everything in the catalogue is scoped by `storeId`, and the active store is resolved
  from `DEFAULT_STORE_SLUG` or the oldest active store — never a hardcoded id.
- Collection endpoints return `{ items, pagination: { page, limit, total, totalPages } }`.
- Order status moves only through `OrdersService.changeStatus`, which validates every
  transition against the state machine for that order's fulfilment method. No endpoint
  anywhere assigns a status directly.
- A store manager's scope comes from `AuthenticatedUser.storeId` (re-read from the
  database on every request), never from a request. Store-scoped services take the store
  as an explicit argument that lands **in the query filter**, so cross-store access is
  structurally impossible rather than checked afterwards.
- A substitution never increases what a customer pays. The accepted line keeps the
  agreed total and the store absorbs any difference; a dearer replacement is refused.
- Business failures carry a stable `code` (see `ErrorCode`) alongside a message written
  for a shopper. Clients branch on the code and display the message; the message may be
  reworded freely, the code may not.
- Orders snapshot everything they display — item names, prices, the delivery address, the
  measured distance. A historical order never reads through to a live Product, Address or
  pricing rule, so it stays correct when those change.
- Order status moves only through `OrdersService.changeStatus`, which validates the
  transition against the state machine for that order's fulfilment method. No endpoint
  accepts a status from a client.
- Stock is taken with a single guarded `$inc` whose condition lives in the update filter.
  Never read stock, check it, then write it — that races and oversells.
- Order creation requires an `Idempotency-Key` header. A retry with the same key returns
  the original order instead of creating a second one.
- The AI service returns intelligence, never decisions. Product identity, price, stock and
  the cart belong to NestJS; the AI tier contributes normalisation ("doodh" is milk) and
  has no way to express a product id or a price at all.
- Every AI response is validated against a schema before it is believed. A malformed one
  is treated as a service failure, not as data.
- Uploaded images are held in memory and never written to disk — no temporary file to
  leak, no path to traverse. File type is decided by the magic bytes, never by the
  filename or the declared Content-Type.
- OCR confidence ("how well was this line read?") and match confidence ("is this the right
  product?") are separate measurements and are never conflated. An unreported confidence
  stays `null`; it is never rendered as a number nobody measured.
- A scan changes nothing. The shopper reviews the result and confirms, and the confirm
  request carries only product ids and quantities — everything else is re-read from the
  catalogue.
