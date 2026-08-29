# FreshCarts

Grocery commerce platform for Pakistani shoppers. Mobile-first customer web app with
a deliberate desktop adaptation, backed by a role-aware API.

- `backend/` — NestJS + MongoDB (Mongoose) API
- `frontend/` — Next.js App Router customer web app

Roles: `CUSTOMER`, `STORE_MANAGER`, `ADMIN` — one API and one RBAC system for all three.

---

## Prerequisites

| Tool    | Version                          |
| ------- | -------------------------------- |
| Node.js | 20+ (developed on 22.12)         |
| npm     | 10+                              |
| MongoDB | 6+ running locally, or an Atlas cluster |

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

Seed development accounts:

```bash
npm run seed
```

`npm run seed:fresh` wipes seeded collections first. Seeding refuses to run when
`NODE_ENV=production`.

Other scripts: `npm run build`, `npm test`, `npm run lint`.

## Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Runs on `http://localhost:3000`. Other scripts: `npm run build`, `npm run typecheck`,
`npm run lint`.

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
