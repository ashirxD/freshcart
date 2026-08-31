# FreshCarts

Grocery commerce platform for Pakistani shoppers. Mobile-first customer web app with
a deliberate desktop adaptation, backed by a role-aware API.

- `backend/` — NestJS + MongoDB (Mongoose) API
- `frontend/` — Next.js App Router customer web app
- `ai-service/` — Python + FastAPI OCR service behind "Scan Grocery List"

Roles: `CUSTOMER`, `STORE_MANAGER`, `ADMIN` — one API and one RBAC system for all three.

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

Seed the development catalogue — one store, 31 categories/subcategories, 53 grocery
products with stock, and the demo accounts:

```bash
npm run seed
```

`npm run seed:fresh` wipes the seeded collections first. Seeding is idempotent, writes
through the real services (so it passes the same validation as an admin would), and
refuses to run when `NODE_ENV=production`.

Demo accounts (from `.env`):

| Role                            | Phone           | Password         |
| ------------------------------- | --------------- | ---------------- |
| ADMIN                           | `+923001234567` | `Admin@12345`    |
| CUSTOMER                        | `+923001234569` | `Customer@12345` |
| STORE_MANAGER (Gulberg)         | `+923001234568` | `Manager@12345`  |
| STORE_MANAGER (Johar Town)      | `+923001234571` | `Manager@12345`  |

Two stores are seeded, each with its own manager. Only Gulberg has a catalogue —
the second exists so store isolation is something you can check by signing in
rather than only by reading a test: as the Johar Town manager, the order queue is
empty because those orders belong to Gulberg.

The seed deliberately includes an out-of-stock product, a low-stock product and a
deactivated product, so every state the UI must handle is reachable immediately.

Other scripts: `npm run build`, `npm test`, `npm run lint`.

## Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Runs on `http://localhost:3000`. Other scripts: `npm run build`, `npm run typecheck`,
`npm run lint`, `npm test`.

Customer routes: `/`, `/categories`, `/categories/[slug]`, `/products/[slug]`, `/search`,
`/cart`, `/checkout`, `/checkout/confirmation/[id]`, `/orders`, `/orders/[id]`,
`/addresses`, `/favorites`, `/scan`. The back office lives under `/admin` (products,
categories, inventory) and requires an ADMIN account.

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
