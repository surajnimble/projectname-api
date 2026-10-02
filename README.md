# Local development

## Requirements

- Node.js 20+
- A PostgreSQL database
- Optional: Redis (Upstash in production, local Redis for development)

## First run

```bash
npm install
npx prisma generate
cp .env.example .env      # then fill in the values below
npm run db:migrate        # create the schema
npm run seed              # settings, SUPER_ADMIN, demo data
npm run dev
```

## Database

There are three supported ways to get a database.

### Option A — Render Postgres (current setup)

The dashboard shows two URLs. Use the **External** one:

| URL | Resolves from | Use for |
| --- | --- | --- |
| Internal | inside Render only | your deployed Web Service |
| External | anywhere, incl. your laptop | local dev + running tests |

```
DATABASE_URL="postgresql://USER:PASS@dpg-xxxx-xxxx.<region>-postgres.render.com:5432/DB?schema=public&connection_limit=5"
```

With `PGLITE_MODE=false`. Apply the schema and seed:

```bash
npx prisma migrate deploy
npm run seed
```

### Option B — Docker (closest to a self-hosted production box)

```bash
docker compose up -d
npm run db:migrate
npm run seed
```

### Option C — no Docker, PGlite (Windows-friendly fallback)

```bash
npm run db:up      # starts a real PostgreSQL (WASM) on 127.0.0.1:5432
npm run db:migrate
npm run seed
```

PGlite is genuine PostgreSQL 17 compiled to WebAssembly, so the same SQL,
constraints and migrations run. It exists because a normal `postgres.exe` cannot
start on some Windows machines where antivirus blocks child-process creation
(backends die with `STATUS_DLL_INIT_FAILED` / `0xC0000142`).

```bash
npm run db:status     # is it up?
npm run db:restart    # bounce it (needed between test runs — see below)
npm run db:down       # stop it
npm run db:check      # summarise what the seed produced
```

Two settings are required in `.env` for PGlite, and both must be **removed** when
you point at a real PostgreSQL server:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&connection_limit=1"
PGLITE_MODE=true
```

- `pgbouncer=true` — the bridge reuses one connection, so named prepared
  statements collide with `42P05 already exists`. This disables them.
- `connection_limit=1` — caps the pool at that single connection.
- `PGLITE_MODE=true` — serialises Prisma queries so overlapping calls do not
  trip over the single connection. No-op against a real server.

**PGlite serves one client at a time.** Restart it between test runs:

```bash
npm run db:restart
```

That is also why `prisma migrate dev` does not work against it (it needs a
concurrent shadow database). Use `npm run db:migrate` locally and
`npx prisma migrate deploy` in CI/production.

## Redis

Optional. With `REDIS_URL` empty the API still runs — caching is skipped and rate
limiting falls back to in-process counters. Jobs and realtime analytics need it:

```bash
QUEUE_ENABLED=true
WORKER_ENABLED=true
```

## Tests

```bash
npm run typecheck      # tsc --noEmit
npm run test           # 64 unit/contract tests, no database needed
npm run e2e:all        # live HTTP suites (restarts the PGlite bridge between them)
npm run verify         # typecheck + lint + unit tests
```

Live suites drive the real Express app through supertest against a live
PostgreSQL database, so they assert behaviour rather than mocks. Every response
is checked against the strict envelope (`status` / `message` / `result`, no
`null` at any depth), and role boundaries are asserted explicitly.

| Suite | Covers | Checks |
| --- | --- | --- |
| `e2e-smoke.ts` | auth: register / login / refresh / logout / RBAC | 29 |
| `e2e-user-vendor.ts` | profile, addresses, KYC, vendor approval, payout request | 76 |
| `e2e-product.ts` | catalogue CRUD, variants, images, stock, recommendations | 62 |
| `e2e-catalog.ts` | brands, tags, attributes, collections, categories | 63 |
| `e2e-cart.ts` | cart, coupons, wishlist | 121 |
| `e2e-order.ts` | cart-to-order split, state machine, cancellation, timeline | 124 |
| `e2e-payment.ts` | payment, refund, wallet, payout, return | 118 |
| `e2e-review.ts` | reviews, questions, coupons, flash sales | 101 |
| `e2e-shipping.ts` | zones, methods, partners, riders, settings, admin, API keys | 113 |
| `e2e-notification.ts` | notifications, chat, tickets | 105 |
| `e2e-analytics.ts` | tracking, analytics, funnels, search, uploads | 98 |
| `e2e-content.ts` | pages, blog, FAQ, banners, contact, geo, currency, tax, translations, dropdowns, webhooks, bulk import, reports | 211 |
| `e2e-engagement.ts` | loyalty, referrals, gift cards, message templates | 161 |
| `e2e-encryption.ts` | AES-256-GCM transport, maintenance mode | 23 |

**1,405 live checks + 64 unit tests.**

Run them individually:

```bash
npm run e2e                  # auth
npm run e2e:content          # content module
npm run e2e:engagement       # loyalty / referral / gift cards / templates
npm run e2e:encryption       # transport encryption
npx tsx scripts/e2e-order.ts # any suite by path
```

`scripts/run-e2e.ps1` runs a suite to completion in one blocking call and prints
only the summary plus any failures, instead of polling in slices:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-e2e.ps1 -Script scripts/e2e-content.ts
```

> **The suites share one database.** `loyalty.enabled`, `referral.enabled` and
> `giftCard.enabled` gate the engagement module, so `e2e-engagement.ts` pins those
> settings at the start and restores them in its cleanup. If a suite is killed
> mid-run the settings can be left flipped; the next run resets them.
>
> If the shared database gets reset by anything else, `SUPER_ADMIN` disappears
> and every staff route returns 401. `npm run seed` is idempotent and restores it.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with hot reload |
| `npm run build` | `prisma generate` + `tsc` |
| `npm start` | Run the compiled server |
| `npm run prisma:studio` | Browse data in a GUI |
| `npm run prisma:diff` | Print the SQL for the current schema |
| `npm run prisma:deploy` | Apply pending migrations |
| `npm run seed` | Idempotent seed (settings, RBAC, SUPER_ADMIN, demo data) |
| `npm run verify` | typecheck + lint + unit tests |

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. `npm ci`
2. `npm run prisma:generate`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test` (unit, no database)

Formatting is **not** a CI step: most of the tree predates the Prettier config, so
`npm run format:check` would fail until the whole repo is reformatted in one pass.
It is enforced per-commit by `lint-staged` instead (below).

The live suites are **not** in CI. They need a real PostgreSQL and take several
minutes, so they run locally or on a self-hosted runner:

```bash
npm run e2e:content
npm run e2e:engagement
```

`npm run verify` is the gate that must pass before pushing.

### Git hooks

Husky runs on `git commit`:

- `pre-commit` — `lint-staged` formats and lints the staged files only, so a
  commit cannot introduce a formatting or lint failure. Configured in
  `.lintstagedrc`; the hook lives in `.husky/pre-commit` and is wired up by the
  `prepare` script (`husky`), which `npm install` runs automatically.

> This checkout is not a git repository yet, so `husky init` could not set
> `core.hooksPath`. Run `git init && npm install` once and the hook activates.

`typecheck` and the unit tests are deliberately **not** in `pre-commit`: they take
long enough to make committing unpleasant. `npm run verify` covers both, and CI
enforces them.

## Endpoints

- API — `http://localhost:5000/api/v1`
- Swagger UI — `http://localhost:5000/api/v1/docs`
- OpenAPI JSON — `http://localhost:5000/api/v1/docs.json`
- Health (Render probes this) — `http://localhost:5000/api/v1/health`

## Modules

384 endpoints across 17 module directories, backed by a 97-model schema. A few
directories export more than one router, so they mount at several prefixes.

| Module | Mount | Endpoints |
| --- | --- | --- |
| content | `/content` | 59 |
| shipping | `/shipping`, `/settings`, `/admin`, `/delivery-boys` | 36 |
| analytics | `/tracking`, `/analytics`, `/search`, `/upload` | 34 |
| engagement | `/loyalty`, `/referrals`, `/gift-cards`, `/templates` | 32 |
| review | `/reviews`, `/coupons`, `/flash-sales` | 27 |
| notification | `/notifications`, `/chat`, `/tickets` | 26 |
| payment | `/payments`, `/payouts`, `/wallet`, `/returns` | 24 |
| auth | `/auth` | 23 |
| catalog | `/brands`, `/tags`, `/attributes`, `/collections` | 23 |
| product | `/products` | 20 |
| user | `/users` | 17 |
| vendor | `/vendors` | 17 |
| cart | `/cart`, `/wishlist` | 16 |
| order | `/orders` | 16 |
| category | `/categories` | 8 |
| health | `/health` | 5 |
| system | `/version` | 1 |

### Conventions

Every module follows the same shape: `<module>.schema.ts` (zod, `strict()` so
unknown fields are rejected), `<module>.service.ts` (Prisma, throws `AppError`),
`<module>.controller.ts` (`asyncHandler` + `ApiResponse`), `<module>.routes.ts`.

- **Envelope** — responses have exactly `status`, `message`, `result`, in that
  order. `result` is always an object and never contains `null`. Errors append the
  code to the message: `"Product not found. Error Code (NOT_FOUND)"`.
- **Pagination** — only list endpoints, and the fields come first inside `result`.
- **Naming** — CRUD resources are REST-style; self-operations are camelCase verbs
  (`updateProfile`, `cancelOrder`, `getAll`).
- **Serialization** — serializers live in `src/utils/serialize.ts` and coerce every
  field, so a nullable column cannot leak a `null` into a response. Credentials
  (`fcmToken`, webhook secrets, API key secrets) are never selected at all.
- **Authorization** — `optionalAuth` for endpoints that personalise output,
  `authenticate` plus `requireRole(...)` for everything else. Guards are applied
  per route, never per controller body.
- **Feature flags** — behaviour that can be switched off reads its setting at call
  time (`getSetting`), never from a module-level constant.

### Settings-driven behaviour

`GET /settings/getPublic` exposes the flags that change how the API behaves:
`loyalty.enabled`, `referral.enabled`, `giftCard.enabled`, `payment.*`,
`shipping.*`, `return.*`, `catalog.*`, `security.*`. Each has a seeded default, so
a fresh database is immediately usable.

## Seeded logins

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | `superadmin@projectname.com` | `SuperSecret@123` (or `SUPER_ADMIN_PASSWORD`) |
| SUB_ADMIN | `subadmin@projectname.com` | `Demo@12345` |
| VENDOR | `vendor@projectname.com` | `Demo@12345` |
| CUSTOMER | `customer@projectname.com` | `Demo@12345` |

Seeding is idempotent — every write is an `upsert`, so re-running never
duplicates rows and never clobbers settings an admin has changed.

## Deployment (Render)

Build: `npm ci && npx prisma migrate deploy && npm run build`
Start: `npm start`
Health check path: `/api/v1/health`

Set `PGLITE_MODE=false` in production. On Render, use the **external** database
URL so the service can also be reached from your machine while debugging.

> The free Render Postgres plan expires after 30 days — upgrade before it does or
> the data is deleted.