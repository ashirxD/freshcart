# FreshCarts API reference

Base URL: `http://localhost:4000/api/v1` (the prefix comes from `API_PREFIX`).
Health probes sit **outside** the prefix, at `/health` and `/health/ready`, so
infrastructure can reach them without knowing the API version.

> **Why this file and not Swagger.** Generating OpenAPI would mean decorating
> every DTO and handler with `@ApiProperty`/`@ApiResponse` — roughly a hundred
> endpoints and sixty DTOs — plus a runtime dependency, for output this document
> already provides. Section 69 asks for the endpoints to be documented, and
> permits Swagger "only if appropriate". If an external consumer ever needs a
> machine-readable contract, `@nestjs/swagger` can be added incrementally: the
> DTOs are already the single source of truth for request shapes.

---

## Conventions

**Authentication.** Every route requires a valid access token unless marked
Public. Send it as `Authorization: Bearer <accessToken>`. The refresh token is
an httpOnly cookie and is never readable by JavaScript.

The token identifies *who is asking*; the role and store binding are re-read
from the database on every single request, so a demotion or deactivation takes
effect on the next call rather than when the token expires.

**Roles.** `CUSTOMER`, `STORE_MANAGER`, `ADMIN`. A role is never read from a
request body, query string or header — only from the verified principal.

**Pagination.** Every collection endpoint accepts `?page=` (default 1) and
`?limit=` (default 20, hard maximum 60) and returns:

```json
{
  "items": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 }
}
```

**Money.** Whole Pakistani rupees, as integers. There is no paisa anywhere in
the system, so every subtotal is an exact integer sum.

**Errors.** Business failures carry a stable machine-readable `code` beside a
message written for a person:

```json
{
  "statusCode": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "Only 2 packs of Nurpur Butter are left.",
  "details": { "productId": "...", "available": 2 }
}
```

Branch on `code`; display `message`. The message may be reworded at any time,
the code may not.

**Status codes.**

| Code | Meaning |
| ---- | ------- |
| 200 / 201 | Success |
| 400 | Malformed request or failed validation |
| 401 | Missing, expired or invalid token |
| 403 | Authenticated, but the wrong role |
| 404 | Not found — **also returned for a resource that exists but belongs to somebody else** |
| 409 | Business conflict: stock, price change, illegal status transition, duplicate |
| 422 | Semantically invalid business input |
| 429 | Rate limited |
| 500 | Unexpected failure. Internal details are never included |

> **404 over 403 for ownership.** Telling a caller that an id is real but belongs
> to another customer or another store is itself a small leak, and there is
> nothing they could do with the distinction.

**Rate limiting.** A global throttle (`THROTTLE_LIMIT` per `THROTTLE_TTL`,
default 120/minute) applies to everything. Grocery-list scanning has its own
tighter per-shopper allowance, because one scan occupies an OCR engine for
seconds.

---

## Authentication — `/auth`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/auth/register` | Public | Create a customer account |
| POST | `/auth/login` | Public | Exchange phone + password for a session |
| POST | `/auth/refresh` | Public (cookie) | Rotate the refresh token, issue a new access token |
| POST | `/auth/logout` | Any | Clear the session and the stored refresh hash |
| GET | `/auth/me` | Any | The current principal |

**POST `/auth/register`**

```json
{ "fullName": "Ayesha Khan", "phone": "03001234599", "password": "Secret123", "email": "a@example.com" }
```

`phone` accepts `03001234567`, `923001234567` or `+923001234567` and is stored
in one canonical E.164 form. `password` must be 8–72 characters with at least
one letter and one digit. `role` is **not** accepted: the validation pipe runs
with `forbidNonWhitelisted`, so sending it is a 400, not a silent ignore.

Returns `201` with `{ user, accessToken }` and sets the refresh cookie.

Errors: `409` phone or email already registered.

---

## Users — `/users`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/users/me` | Any | Read your own account |
| PATCH | `/users/me` | Any | Edit your own name, email, language |
| GET | `/users` | ADMIN | List accounts (`?role=`, `?isActive=`, `?search=`) |
| GET | `/users/:id` | ADMIN | One account |
| PATCH | `/users/:id/role` | ADMIN | Change a role (`storeId` required for STORE_MANAGER) |
| PATCH | `/users/:id/status` | ADMIN | Activate or deactivate |

`PATCH /users/me` deliberately does not accept `role`, `phone` or `isActive` —
the fields a user must not be able to change about themselves. A role change
clears the stored refresh token, because the old role is baked into any issued
access token.

No response anywhere includes `passwordHash` or `refreshTokenHash`; both are
`select: false` on the schema and are read only by the auth flow.

---

## Stores — `/stores`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/stores/current` | Public | The store the shopper is buying from |
| GET | `/stores` | ADMIN | All stores (`?includeInactive=true`) |
| GET | `/stores/:id` | ADMIN | One store |
| POST | `/stores` | ADMIN | Create |
| PATCH | `/stores/:id` | ADMIN | Update name, address, coordinates, hours, status |

`location` is sent as `{ latitude, longitude }` and stored as GeoJSON
`[longitude, latitude]`. The coordinate is not decoration: every delivery fee is
priced from the road distance between it and the shopper's address.

Errors: `409` a closing time that precedes its opening time.

---

## Categories — `/categories`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/categories` | Public | The tree (`?includeInactive=` honoured for ADMIN only) |
| GET | `/categories/:idOrSlug` | Public | One category, with ancestors |
| POST | `/categories` | ADMIN | Create |
| PATCH | `/categories/reorder` | ADMIN | Bulk display order |
| PATCH | `/categories/:id` | ADMIN | Update |
| PATCH | `/categories/:id/status` | ADMIN | Deactivate / reactivate |
| DELETE | `/categories/:id` | ADMIN | Delete — refused if it holds products |

Slugs are unique per store. Parent/child cycles are refused. A customer who
guesses `includeInactive=true` still gets the active tree rather than a 403,
which would confirm hidden categories exist.

Errors: `409` circular parent, duplicate slug, or a category that still holds
products or subcategories.

---

## Products — `/products`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/products` | Public | Search, filter, sort, paginate |
| GET | `/products/brands` | Public | Distinct brands, for the filter panel |
| GET | `/products/:idOrSlug` | Public | One product with live availability |
| GET | `/products/:idOrSlug/related` | Public | Same-category suggestions |
| POST | `/products` | ADMIN | Create (also creates the stock row) |
| PATCH | `/products/:id` | ADMIN | Update any catalogue field |
| PATCH | `/products/:id/status` | ADMIN | Take off sale / put back |
| DELETE | `/products/:id` | ADMIN | Delete — refused if referenced |

Query parameters: `search`, `categoryId`, `subcategoryId`, `brand`, `minPrice`,
`maxPrice`, `isFeatured`, `inStockOnly`, `sort` (`newest`, `price_asc`,
`price_desc`, `name_asc`, `popular`), `page`, `limit`.

Availability (`IN_STOCK` / `LOW_STOCK` / `OUT_OF_STOCK`) is derived from the
inventory row on read and never persisted, so it cannot go stale behind a
quantity write.

Prefer `PATCH /:id/status` over `DELETE`. A product referenced by a historical
order must not be removed — the order snapshots what it needs, but the link is
still worth keeping.

---

## Inventory — `/inventory`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/inventory` | ADMIN | Stock list (`?search=`, `?status=`, `?lowStockOnly=`) |
| GET | `/inventory/:productId` | ADMIN | One stock row |
| PATCH | `/inventory/:productId` | ADMIN | Set or adjust |

```json
{ "quantity": 40 }                          // absolute — a stock take
{ "adjustBy": 12, "changeReason": "RESTOCK" } // relative — a delivery
```

Exactly one of `quantity` or `adjustBy`; sending both is a 400. A negative
`adjustBy` is applied with its guard **in the update filter**, so two
simultaneous adjustments cannot both read 10 and both write 12.

Customers never read a raw quantity and can never write one.

---

## Cart — `/cart`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/cart` | CUSTOMER | The cart, repriced against the live catalogue |
| POST | `/cart/items` | CUSTOMER | Add `{ productId, quantity }` |
| PATCH | `/cart/items/:productId` | CUSTOMER | Change a line quantity |
| DELETE | `/cart/items/:productId` | CUSTOMER | Remove a line |
| DELETE | `/cart` | CUSTOMER | Empty it |
| POST | `/cart/accept-prices` | CUSTOMER | Acknowledge changed prices |

The client sends product ids and quantities only. Prices, line totals and the
subtotal are computed server-side from the catalogue on every read — a price in
a request body is ignored, not trusted.

Errors: `409 PRODUCT_UNAVAILABLE`, `409 INSUFFICIENT_STOCK`, `409 PRICE_CHANGED`.

---

## Addresses — `/addresses`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/addresses` | CUSTOMER | Your address book |
| POST | `/addresses` | CUSTOMER | Add |
| GET | `/addresses/:id` | CUSTOMER | One address |
| PATCH | `/addresses/:id` | CUSTOMER | Edit |
| DELETE | `/addresses/:id` | CUSTOMER | Remove |
| PATCH | `/addresses/:id/default` | CUSTOMER | Make default |

`userId` is taken from the token and is part of the query filter on every one of
these, so there is no id a shopper can change to reach another shopper's
address. A wrong id returns `404`.

---

## Checkout — `/checkout`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/checkout/preview` | CUSTOMER | Validated, priced, server-authoritative preview |

```json
{ "fulfillmentMethod": "DELIVERY", "addressId": "...", "paymentMethod": "CASH_ON_DELIVERY" }
```

Returns items, subtotal, delivery fee, total, the measured distance and the
service radius. Nothing in the request influences a price: the fee comes from
the pricing engine, the distance from the routing provider.

Errors: `400 CART_EMPTY`; `409 STORE_UNAVAILABLE` (closed, or ordering paused
platform-wide); `409 DELIVERY_UNAVAILABLE` with
`details: { distanceMeters, maxDistanceMeters }`; `409 INSUFFICIENT_STOCK`;
`409 PRICE_CHANGED`; `503 ROUTING_UNAVAILABLE`.

---

## Orders — `/orders` (customer)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/orders` | CUSTOMER | Your order history (`?status=`) |
| GET | `/orders/:id` | CUSTOMER | One order with its timeline |
| POST | `/orders` | CUSTOMER | Place the order |
| POST | `/orders/:id/cancel` | CUSTOMER | Cancel, where the rules allow |
| GET | `/orders/:orderId/substitutions` | CUSTOMER | Proposals on your order |
| PATCH | `/orders/substitutions/:substitutionId` | CUSTOMER | Accept or reject one |

**POST `/orders` requires an `Idempotency-Key` header.** It is not optional:

```
Idempotency-Key: 6f1c8d2e-4b7a-4f31-9d55-0a2b3c4d5e6f
```

Pattern `^[A-Za-z0-9._:-]{8,100}$`. Replaying the same key returns the original
order instead of creating a second one. A duplicate order is the most damaging
thing this endpoint can do — the shopper is billed twice and the store picks
twice — so the protection is mandatory rather than opt-in.

**Nothing here accepts a status.** The only customer-initiated transition is
`cancel`, which is a named operation with its own rules.

Errors: `400` missing or malformed idempotency key; `409 ORDER_NOT_CANCELLABLE`;
`409 DUPLICATE_REQUEST` (the same key is still in flight).

---

## Payments — `/payments`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/payments/methods` | CUSTOMER | Methods actually accepted |

A method is offered only if it is both listed in `PAYMENT_METHODS_ENABLED` and
backed by a registered provider. Cash is recorded as collected when the order is
handed over, by the order lifecycle — there is no endpoint that sets a payment
status directly.

---

## Favorites — `/favorites`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/favorites` | CUSTOMER | Saved products |
| GET | `/favorites/ids` | CUSTOMER | Just the ids, for filled hearts |
| POST | `/favorites/:productId` | CUSTOMER | Save |
| DELETE | `/favorites/:productId` | CUSTOMER | Unsave |

---

## Grocery-list scanning — `/ocr`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/ocr/availability` | CUSTOMER | Whether the AI service is reachable |
| POST | `/ocr/grocery-list` | CUSTOMER | Upload a photo, get matched products |
| POST | `/ocr/grocery-list/confirm` | CUSTOMER | Add the confirmed lines to the cart |

`multipart/form-data`, field `image`. Limits: `SCAN_MAX_IMAGE_BYTES` (8 MB) and
`SCAN_RATE_LIMIT` scans per window. The file type is decided by **magic bytes**,
never by the filename or the declared `Content-Type`. Images are held in memory
and never written to disk — no temporary file to leak, no path to traverse.

A scan changes nothing. The confirm request carries only product ids and
quantities; every price, name and stock level is re-read from the catalogue. The
AI tier has no way to express a product id or a price at all.

Errors: `400 IMAGE_INVALID`; `413 IMAGE_TOO_LARGE`; `422 IMAGE_UNREADABLE`;
`429` rate limited; `503 SCAN_UNAVAILABLE`; `502 SCAN_FAILED` (it answered, with
something that failed schema validation).

---

## Store operations — `/store-manager` (STORE_MANAGER only)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/store-manager/dashboard` | The operational summary, one request |
| GET | `/store-manager/orders` | The queue (`?status=`, `?needsAction=`, `?orderNumber=`) |
| GET | `/store-manager/orders/:id` | One order with its substitutions |
| PATCH | `/store-manager/orders/:id/status` | Advance the order |
| POST | `/store-manager/orders/:id/reject` | Reject, with a structured reason |
| GET | `/store-manager/orders/:orderId/substitutions` | Proposals on an order |
| POST | `/store-manager/orders/:orderId/items/:productId/substitution` | Propose a swap |
| DELETE | `/store-manager/substitutions/:id` | Withdraw a proposal |
| GET | `/store-manager/inventory` | Store stock |
| GET | `/store-manager/inventory/:productId` | One stock row |
| GET | `/store-manager/inventory/:productId/history` | Recent movements |
| PATCH | `/store-manager/inventory/:productId` | Set or adjust stock |
| GET | `/store-manager/products` | Store catalogue, including hidden |
| GET | `/store-manager/products/:id` | One product |
| PATCH | `/store-manager/products/:id/availability` | Take off sale / put back |

**No endpoint here accepts a `storeId`.** The scope comes from the authenticated
principal and lands in the query filter, so cross-store access is structurally
impossible rather than checked afterwards. An order belonging to another store
returns `404`.

A manager can change availability but not price, category or SKU — those stay
with ADMIN. ADMIN is deliberately *not* granted this surface: an admin has no
store binding, so "their store" would be a silent single-store assumption.

Errors: `403 STORE_NOT_ASSIGNED` (a manager with no store — fails closed, never
falls back to a default); `409 INVALID_STATUS_TRANSITION`; `400` a terminal
transition with no reason.

---

## Admin control centre — `/admin` (ADMIN only)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/admin/dashboard` | The whole control centre, one aggregated request |
| GET | `/admin/orders` | Every store's orders |
| GET | `/admin/orders/:id` | One order, from its snapshot |
| PATCH | `/admin/orders/:id/status` | Operational override — reason mandatory |
| GET | `/admin/customers` | Customer accounts |
| GET | `/admin/customers/:id` | One customer with trading history |
| PATCH | `/admin/customers/:id/status` | Activate / deactivate |
| GET | `/admin/store-managers` | Staff accounts |
| GET | `/admin/store-managers/:id` | One staff account |
| POST | `/admin/store-managers` | Create a manager, bound to a store |
| PATCH | `/admin/store-managers/:id` | Edit name, email, store assignment |
| PATCH | `/admin/store-managers/:id/status` | Activate / deactivate |
| GET | `/admin/inventory` | Stock list |
| PATCH | `/admin/inventory/:productId` | Set or adjust stock |
| GET | `/admin/delivery/pricing-rules` | Bands, plus the problems in the set |
| POST | `/admin/delivery/pricing-rules` | Add a band |
| PATCH | `/admin/delivery/pricing-rules/:id` | Edit a band |
| DELETE | `/admin/delivery/pricing-rules/:id` | Delete a band |
| GET | `/admin/settings` | Business settings + read-only deployment facts |
| PATCH | `/admin/settings` | Save business settings |
| GET | `/admin/audit-logs` | The administrative trail |

Products, categories and stores are **not** duplicated here — they already have
ADMIN-guarded routes at `/products`, `/categories` and `/stores`, and two
endpoints for one operation is what section 104 warns against.

**GET `/admin/dashboard`** returns orders (today, this week, by status),
catalogue counts, stock bands, headcounts, store status and the platform
switches, from seven concurrent aggregations. Revenue counts orders that were
placed and not cancelled, rejected or failed, at the totals they were charged.

**PATCH `/admin/orders/:id/status`**

```json
{ "status": "PREPARING", "reason": "Store phone is down; confirming for them" }
```

The transition still goes through the same state machine a store manager's click
does. An admin cannot revive a cancelled order, cannot send a pickup order out
for delivery and cannot skip a step. What they gain is reach across stores, and
the ability to act when nobody at the store can. The reason is required at every
status (not only terminal ones), reaches the customer's timeline, and is
recorded in the audit trail.

**Delivery pricing bands** are half-open, `[min, max)`. `0–2000` and
`2000–5000` leave no gap and no overlap; 2000 m belongs to exactly one of them.
Creating a band that overlaps an active one is refused with the clashing band
named. The last active band cannot be deleted, because a store with no bands
cannot price a delivery at all.

Errors: `409` overlapping band; `400` inverted or empty range;
`409` deleting the only active band.

**PATCH `/admin/settings`** accepts any subset of
`maxDeliveryDistanceMeters`, `defaultLowStockThreshold`, `orderingEnabled`,
`supportPhone`, `supportEmail`. Only fields that genuinely changed are written,
and each one is recorded in the audit trail with its before and after.

`orderingEnabled: false` stops every new order platform-wide, whatever a store's
opening hours say. Orders already placed are unaffected.

**GET `/admin/audit-logs`** — `?action=`, `?entityType=`, `?entityId=`,
`?actorId=`, `?from=`, `?to=`. Each row answers who did what, to which resource,
when. Passwords, tokens and payment secrets are stripped before a row is
written, nested objects are dropped rather than recursed into, and strings are
truncated — see `AuditService.sanitiseMetadata`.

---

## Platform settings — `/settings`

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/settings/public` | Public | Support contact, service radius, ordering status |

Public because a shopper who cannot sign in is exactly the person who needs the
support number. Four fields only; the admin view, which includes deployment
facts, is behind `/admin/settings`.

---

## Health — `/health` (unprefixed)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/health` | Public | Liveness: the process is running |
| GET | `/health/ready` | Public | Readiness: it can serve traffic |

`/health/ready` actively pings MongoDB — a socket can look open while the server
is unreachable, which is exactly the case a readiness probe exists to catch. It
returns `200` when healthy and `503` when the database is down, so an
orchestrator can act on the status code alone.

Neither probe performs an expensive operation.

---

## Order state machine

```
                 ┌──────────► REJECTED     (store refuses, reason required)
                 │
PENDING ──► CONFIRMED ──► PREPARING ──► PACKED ──┬──► OUT_FOR_DELIVERY ──► DELIVERED
   │             │            │            │     │        (delivery)
   │             │            │            │     └──► READY_FOR_PICKUP  ──► DELIVERED
   │             │            │            │                (pickup)
   └─────────────┴────────────┴────────────┴──────────► CANCELLED / FAILED
```

The two fulfilment paths are enforced separately: a pickup order can never go
`OUT_FOR_DELIVERY`, and a delivery order can never go `READY_FOR_PICKUP`.
Terminal states are terminal — a cancelled order cannot become delivered, and a
delivered order cannot be cancelled.

Every transition passes through `OrdersService.changeStatus`, which is the only
place in the codebase that assigns `order.status`. It also owns the side effects
that must accompany particular transitions: stock is returned exactly once on a
cancellation (guarded by a flag, not inferred from the status), and cash is
settled on `DELIVERED`.

No endpoint anywhere accepts a status from a client except as a *target* to be
validated by the machine.
