# projectname-api

Multi-vendor marketplace REST API — Node + Express + TypeScript + Prisma + PostgreSQL + Redis. Backend only; the web, Android and iOS apps consume it.

This is the operational README: what the project is built from, how to run it, how to test it, how to deploy it.

---

## Documentation map

| Document | What it holds |
| --- | --- |
| this file | Tech stack, setup, project structure, commands, environment, deployment, troubleshooting |
| [`FEATURES.md`](FEATURES.md) | What the API does — features, business rules, configuration defaults, edge cases, endpoints, sample requests |
| [`AGENTS.md`](AGENTS.md) | Development guide — module shape, response format, naming, comments, worked example, DO's and DON'Ts |
| `GET /api/v1/docs.json` | The endpoint contract, generated from the live router |

---

## Tech stack

**Core**

- Node.js 20+ (`.nvmrc` pins 22), Express 4, TypeScript (strict)
- Prisma ORM + PostgreSQL (type-safe queries)
- Zod — env schema and every request body / query / params (`/auth/register` uses a discriminated union for `type: CUSTOMER | VENDOR`)
- `dotenv`, `dotenv-cli` — load `.env`, run a command with it
- `cookie-parser` — read the HttpOnly refresh-token cookie
- `cors` — whitelist only (admin, vendor, store domains), no wildcard
- `helmet` — secure HTTP headers (XSS, clickjacking, MIME sniffing)
- `pino` + `pino-http` — structured, level-based logging; one log per request

**Database and cache**

- PostgreSQL — main relational database
- Redis (Upstash / Render Key Value) — cart sessions, cache, rate-limit store, realtime analytics streams
- `ioredis` — the Redis client (not the `redis` package)

**Auth and security**

- `jsonwebtoken` — access + refresh JWT
- `bcrypt` — password hashing
- `express-rate-limit` + `rate-limit-redis` — brute-force and DDoS guard; the Redis store keeps counts across restarts
- `hpp` — HTTP Parameter Pollution guard (duplicate query params)
- `qrcode` — TOTP QR for 2FA (TOTP verification lives in `src/utils/crypto.ts`)
- `ua-parser-js` — device / browser / OS parsing, device fingerprinting
- `geoip-lite` — IP → country / state / city lookup for analytics

**File and media**

- `multer` — multipart form-data to temp disk
- `cloudinary` — permanent media storage, image transforms and CDN
- `pdfkit` — invoice, packing slip, payout statement
- `xlsx` / `csv-parser` — bulk import and export (CSV / Excel)

**Realtime and jobs**

- `socket.io` — chat, live order tracking, realtime analytics
- `bullmq` — background jobs: email, payout calculation, order status, analytics rollup, notification blast

**Utilities**

- `compression` — gzip responses
- `nodemailer` — transactional email; the provider in `src/services/mail/mail.service.ts` is pluggable: Brevo HTTP API (`BREVO_API_KEY`) first, then SMTP, then log only
- `handlebars` — email / SMS template rendering from DB templates
- `slugify` — product / vendor name → URL-safe slug
- `nanoid` — request IDs and invite tokens (not `uuid`)
- `dayjs` — date parse / format
- `swagger-jsdoc` + `swagger-ui-express` — auto-generated OpenAPI docs
- `razorpay` / `stripe` — optional dependencies for online payments

**Dev and test**

- `vitest` — unit tests; `supertest` — HTTP integration
- `eslint` + `prettier` + `husky` + `lint-staged` — code quality and pre-commit hooks
- `@electric-sql/pglite` — in-process Postgres for `npm run db:up`; dev only, never used in production

---

## Requirements

- Node.js 20+ (`.nvmrc` pins 22)
- A PostgreSQL database
- Optional: Redis — background jobs and realtime analytics need it

---

## Quick start

```bash
npm install
npm run prisma:generate
npm run env:sync      # regenerate .env.example from .env
npm run db:migrate    # create the schema
npm run seed          # settings, SUPER_ADMIN, permission matrix, demo data
npm run dev
```

The API is then on <http://localhost:5000/api/v1>.

---

## Project structure

The module layout is **domain-grouped**: one folder per domain, several routers inside it, rather than one resource per folder. That is deliberate — dozens of one-resource folders would mean dozens of routing layers and serializer files for a surface that keeps growing inside the same domains. The mapping below tells you which module owns a route prefix.

```
projectname-api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   ├── 20260101000000_init/                      # the full schema
│   │   └── 20261008000000_customer_vendor_control/   # customer ban, segments, announcements
│   └── seed.ts
├── src/
│   ├── constants/        # roles, permissions, statuses, http, countries, tracking
│   ├── messages/         # success, error, validation text
│   ├── config/           # env, app, pagination, upload, jwt, otp, otp-policy,
│   │                     # password, rateLimit, encryption, currency, logger,
│   │                     # tracking, shipping, analytics, pdf, socket, payment,
│   │                     # setting + setting-defaults
│   ├── middlewares/      # auth, rbac, error, validate, rateLimit, upload,
│   │                     # requestId, encryption, maintenance, tracking, common
│   ├── modules/
│   │   ├── auth/         # register, login, otp, password, sessions, social, 2fa
│   │   ├── user/         # profile, addresses, account
│   │   ├── vendor/       # apply, kyc, payouts, ratings, wallet
│   │   ├── product/      # products, variants, inventory
│   │   ├── category/     # categories
│   │   ├── catalog/      # brand, tag, collection, attribute
│   │   ├── cart/         # cart, wishlist
│   │   ├── order/
│   │   ├── payment/      # payment, payout, return, wallet
│   │   ├── review/       # review, q&a, coupon, flashSale
│   │   ├── engagement/   # loyalty, referral, giftCard, template
│   │   ├── content/      # page, blog, faq, banner, contact, newsletter, report,
│   │   │                 # bulk, apiKey, webhook, currency, tax, country, i18n, dropdown
│   │   ├── notification/ # notification, chat, ticket
│   │   ├── shipping/     # shipping, deliveryBoy, settings, admin, audit, activityLog
│   │   ├── analytics/    # tracking, device, analytics, search, upload
│   │   ├── system/       # version, maintenance
│   │   └── health/       # /api/v1/health
│   ├── services/
│   │   ├── mail/mail.service.ts   # brevo → smtp → log
│   │   ├── sms/sms.service.ts     # msg91
│   │   └── settings, audit, cloudinary, notification, pdf, socket,
│   │       email, prisma, redis, logger, template
│   ├── utils/            # AppError, asyncHandler, ApiResponse, defaults,
│   │                     # serialize, pagination, crypto, geo, deviceParser,
│   │                     # slug, dates, calculations, validate
│   ├── jobs/             # BullMQ workers + cron + deadletter.service.ts
│   ├── templates/        # default email HTML (fallback for a missing DB row)
│   ├── routes/           # /api/v1 aggregator
│   ├── docs/             # swagger spec
│   ├── types/            # ambient declarations
│   ├── app.ts
│   └── server.ts
├── scripts/              # dev tooling — not compiled into the build
│   ├── db.ts, apply-migrations.ts, db-reset.ts, seed-check.ts
│   ├── doctor.ts, env-sync.ts, pglite-server.ts
│   ├── comment-audit.ts, comment-normalise.ts
│   ├── route-dump.ts, route-param-audit.ts, generate-postman.ts
│   └── e2e-*.ts, run-e2e.ps1
├── tests/                # vitest
├── .github/workflows/    # CI
├── .env, .env.example    # .env.example is generated — npm run env:sync
├── .gitattributes
├── .nvmrc
├── render.yaml           # Render blueprint
├── tsconfig.json         # typecheck + eslint (scripts and tests included)
├── tsconfig.build.json   # build only — src/ → dist/server.js
├── vitest.config.ts
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

Every module has `<name>.routes.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.schema.ts`, `<name>.types.ts` and `<name>.serializer.ts`. The shape and the serializer registry rules are in `AGENTS.md`.

**Route prefix → module** (from `src/routes/index.ts`):

| Module | Mounted prefixes |
| --- | --- |
| `auth/` | `/auth` |
| `user/` | `/users` |
| `vendor/` | `/vendors` |
| `product/` | `/products` |
| `category/` | `/categories` |
| `catalog/` | `/brands`, `/tags`, `/collections`, `/attributes` |
| `cart/` | `/cart`, `/wishlist` |
| `order/` | `/orders` |
| `payment/` | `/payments`, `/payouts`, `/returns`, `/wallet` |
| `review/` | `/reviews`, `/questions`, `/coupons`, `/flashSales` |
| `engagement/` | `/loyalty`, `/referral`, `/giftCards`, `/templates` |
| `content/` | `/pages`, `/blogs`, `/faqs`, `/banners`, `/contact`, `/newsletter`, `/countries`, `/currencies`, `/tax`, `/i18n`, `/content`, `/webhooks`, `/bulk`, `/reports`, `/apiKeys` |
| `notification/` | `/notifications`, `/chat`, `/tickets` |
| `shipping/` | `/shipping`, `/deliveryBoys`, `/settings`, `/admin`, `/auditLogs`, `/activityLogs` |
| `analytics/` | `/track`, `/devices`, `/analytics`, `/search`, `/uploads` |
| `system/` | `/version` |
| `health/` | `/health` |

**What goes into the build:** only `src/`. `tsconfig.build.json` sets `rootDir: ./src` and `outDir: ./dist`, so the entry is `dist/server.js` and `tests/`, `scripts/` and `prisma/` stay out of the image.

---

## Data model

Prisma models, grouped. The schema in `prisma/schema.prisma` is the source of truth; a database can be built from scratch with `npx prisma migrate deploy && npm run seed`.

- **Identity and access:** `User` (role, email, passwordHash, isActive), `RefreshToken` (userId, tokenHash, expiresAt, revokedAt), `Session` (userId, deviceId, ip, userAgent, geo, startedAt, endedAt, isActive), `Otp` (identifier, type, channel, otpHash, expiresAt, attempts), `AuthVerification`, `PasswordHistory` (the last N hashes, for the reuse check), `UserConsent` (TERMS / PRIVACY / MARKETING audit trail), `RolePermission` (role, permission), `UserBlock`
- **Vendors:** `VendorProfile` (userId, shopName, slug, status, commissionRate), `VendorAnnouncement` (vendorId, title, message, linkUrl, status, isPinned, startsAt, endsAt), `Payout` (vendorId, amount, status, period)
- **Catalog:** `Category` (name, slug, parentId), `Brand`, `Tag`, `Attribute` (name, type, options), `Product` (vendorId, categoryId, brandId, name, slug, price, stock, images, status, condition, warrantyMonths, warrantySummary, isNonReturnable), `ProductVariant` (productId, attributes, price, stock, sku), `Collection` (name, slug, type, productIds, rules)
- **Cart and orders:** `Cart` / `CartItem`, `SavedCartItem`, `Wishlist` / `WishlistItem`, `PriceWatch`, `Order`, `SubOrder`, `OrderItem`, `OrderTimeline`, `OrderTag`, `OrderNote`, `IdempotencyKey`
- **Payments:** `Payment` (method, status, reference), `Refund`, `ReturnRequest` / `ReturnItem` / `ReturnReason`, `WalletTransaction`, `LoyaltyTransaction`, `Referral`, `GiftCard`
- **Promotion and reviews:** `Coupon` / `CouponUsage`, `FlashSale` / `FlashSaleItem`, `Banner`, `Review`, `Question` / `Answer`
- **Support and messaging:** `Notification` / `NotificationPreference`, `Conversation` / `Message`, `Ticket` / `TicketMessage` / `TicketCategory` / `TicketNote`, `CannedResponse`
- **Content and localisation:** `Page`, `Blog`, `Faq`, `ContactSubmission`, `NewsletterSubscriber`, `Translation` (locale, key, value), `Dropdown` (type, options), `EmailTemplate`, `SmsTemplate`, `NotificationTemplate`, `Currency`, `Country`, `State`, `City`, `TaxConfig`
- **Shipping:** `ShippingZone`, `ShippingMethod`, `Shipment`, `DeliveryBoy`
- **Platform:** `SystemSetting` (key, value, category, isPublic), `ApiKey`, `WebhookEndpoint`, `WebhookLog`, `BulkJob`, `ReportSchedule`, `AuditLog`, `ActivityLog`, `FailedJob` (queue, jobName, jobId, payload, error, replayCount, status — the dead letter queue, unique on `(queue, jobId)`)
- **Tracking and analytics:** `Device` (deviceId, userId, platform, os, osVersion, browser, model, fcmToken, isBlocked, isTrusted, lastSeenAt), `VisitorLog` (sessionId, deviceId, userId, eventType, eventData, pageUrl, referrer, utm, geo), `PageView` (sessionId, pageUrl, timeOnPage, scrollDepth), `Event` (sessionId, name, meta), `CrashLog` (deviceId, platform, appVersion, errorMessage, stack, breadcrumbs), `Funnel` / `FunnelStep`
- **Customer management:** `CustomerNote` (internal staff note, never exposed to the customer), `CustomerBan` (one row per customer; expiry evaluated at read time), `CustomerSegment` / `CustomerSegmentMember` (`source` separates a hand assignment from a rule-computed one)

The database may hold `null`; the serializer scrubs it before it reaches a client.

---

## Commands

### Clean install

```powershell
# Windows PowerShell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm cache clean --force
npm install
npm run prisma:generate
```

```bash
# macOS / Linux
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run prisma:generate
```

`npm run clean` is the lighter option — it drops build output and caches but keeps `node_modules`.

### Everyday

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with hot reload |
| `npm run build` | `prisma generate` + `tsc -p tsconfig.build.json` → `dist/` |
| `npm start` | Run the compiled server |
| `npm run clean` | Delete `dist/`, `coverage/`, `uploads/tmp/`, caches |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:studio` | GUI data browser |
| `npm run prisma:diff` | Print SQL for the current schema |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npm run seed` | Idempotent seed — settings, RBAC, SUPER_ADMIN, demo data |

### Database

| Command | What it does |
| --- | --- |
| `npm run db:up` | Start local PGlite PostgreSQL (no install needed) |
| `npm run db:status` | Is it up? |
| `npm run db:restart` | Bounce it — needed between e2e runs |
| `npm run db:migrate` | Apply migrations to the local database |
| `npm run db:down` | Stop it |
| `npm run db:check` | Summarise what the seed produced |
| `npm run db:reset` | Drop, recreate, migrate, seed — **dev only** |

`db:reset` refuses a remote or production host on purpose.

### Verifying

| Command | What it does |
| --- | --- |
| `npm run env:check` | Fail if `.env` and `.env.example` drifted |
| `npm run env:sync` | Regenerate `.env.example` from `.env` |
| `npm run comments:check` | Fail if a comment breaks the structure |
| `npm run comments:fix` | Rewrite multi-line `//` prose into doc blocks |
| `npm run doctor` | Database, weak secrets, exposed `.env`, missing providers |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Unit + contract tests, no database needed |
| `npm run test:watch` / `test:coverage` | Watch mode / coverage |
| `npm run e2e` | Live HTTP suites, needs a real database |
| `npm run verify` | **The gate:** env:check + typecheck + lint + test |

### Environment

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # new secret
```

`.env` is split into **required** (the app throws without them) and **optional** (each has a default and a comment).

### Simulating the production build

Run exactly what Render runs:

```bash
npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run seed && npm run build
```

`--include=dev` is required — `NODE_ENV=production` makes npm omit devDependencies, and `prisma` / `typescript` / `tsx` all live there. Do **not** add `--ignore-scripts` — bcrypt fetches its native binary in an install script. In CI or production, `HUSKY=0` is the right way to skip git hooks: it turns the `prepare` hook into a no-op without suppressing install scripts.

Then boot the compiled output in production mode:

```powershell
# Windows PowerShell
$env:NODE_ENV="production"; npm start
```

```bash
# macOS / Linux
NODE_ENV=production npm start
```

This exercises the production env rules: strict CORS, no OTP codes in logs, refusal to boot if `OTP_STATIC_CODE` is set or a delivery provider is missing.

---

## Database

Three supported ways. Migrations are a `20260101000000_init` folder with the full schema, plus a dated folder per later change. Any of them can be built from scratch with `npx prisma migrate deploy && npm run seed`. The rules for adding a migration are in `AGENTS.md`.

### Option A — Render Postgres (current setup)

The dashboard shows two URLs; which one you need depends on where the code runs.

| URL | Resolves from | Use for |
| --- | --- | --- |
| Internal | inside Render only | your deployed Web Service |
| External | anywhere, incl. your laptop | local dev + running tests |

```
DATABASE_URL="postgresql://USER:PASS@dpg-xxxx.<region>-postgres.render.com:5432/DB?schema=public&connection_limit=5"
```

Keep `PGLITE_MODE=false`. The internal hostname only resolves inside Render's private network, which is why a local setup fails with a misleading "database does not exist".

### Option B — Docker (closest to a self-hosted production box)

```bash
docker compose up -d
npm run db:migrate
npm run seed
```

### Option C — no Docker, PGlite (Windows-friendly fallback)

```bash
npm run db:up
npm run db:migrate
npm run seed
```

PGlite is genuine PostgreSQL compiled to WebAssembly — same SQL, same constraints, same migrations. It exists because a normal `postgres.exe` cannot start on some Windows machines where antivirus blocks child-process creation.

Two settings are required, and both must be **removed** when you point at a real PostgreSQL server:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&connection_limit=1"
PGLITE_MODE=true
```

- `pgbouncer=true` — the bridge reuses one connection, so named prepared statements collide with `42P05 already exists`. This disables them.
- `connection_limit=1` — caps the pool at that single connection.
- `PGLITE_MODE=true` — serialises Prisma queries so overlapping calls do not trip over the single connection. No-op against a real server.

**PGlite serves one client at a time**, so restart it between e2e runs. That is also why `prisma migrate dev` does not work against it — it needs a concurrent shadow database. Use `npm run db:migrate` locally and `npx prisma migrate deploy` in CI and production.

---

## Redis

Optional. With `REDIS_URL` empty the API still runs — caching is skipped, jobs are dropped, rate limiting falls back to per-instance counters. Jobs and realtime analytics need it:

```bash
QUEUE_ENABLED=true
WORKER_ENABLED=true
```

`QUEUE_ENABLED=true` without a `REDIS_URL` is a boot error, so set one or the other.

---

## Environment variables

The full inventory is `src/config/env.config.ts` — a Zod schema validated before the server starts; a missing or invalid value stops the boot. `.env` is split into **required** (no default) and **optional** (each has a default). `.env.example` is generated with `npm run env:sync`.

**Required**

| Variable | Rule |
| --- | --- |
| `DATABASE_URL` | Non-empty. The **internal** URL on Render, the external URL on a local machine |
| `JWT_ACCESS_SECRET` | At least 16 chars. Changing it logs everyone out |
| `JWT_REFRESH_SECRET` | At least 16 chars, must differ from the access secret |

**Optional**

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` = strict CORS, secure cookie, codes never logged. **Set it on Render** |
| `PORT` | `5000` | Render injects it |
| `APP_NAME` | `projectname` | JWT issuer / audience — changing it logs everyone out |
| `LOG_LEVEL` | `info` | `fatal` … `trace`; use `debug` for server logs |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | `15m` / `7d` | Token lifetimes |
| `OTP_REQUIRED` | `true` | Master switch for the whole OTP system — see [OTP](#otp) |
| `OTP_SMS_ENABLED` | `false` | Deliver codes to phone numbers |
| `OTP_STATIC_CODE` | *(empty)* | Digits-only fixed code for local work. **Boot error in production** |
| `REDIS_URL` | *(empty)* | Without it cache, queue and rate limit degrade |
| `REDIS_PREFIX` | `projectname` | Redis key namespace |
| `QUEUE_ENABLED` | `true` | `true` with an empty `REDIS_URL` is a boot error |
| `QUEUE_PREFIX` | `projectname` | BullMQ queue namespace |
| `WORKER_ENABLED` | `true` | `false` = serve HTTP only, no workers or cron |
| `TRACKING_ENABLED` | `true` | 2 extra DB queries per request |
| `GEO_LOOKUP_ENABLED` | `true` | GeoLite lookup |
| `RATE_LIMIT_ENABLED` | `true` | `false` also removes the OTP brute-force guard |
| `CORS_ORIGINS` | *(empty)* | Comma-separated, no wildcard. Empty in production rejects every browser origin |
| `SOCKET_CORS_ORIGINS` | *(empty)* | Falls back to `CORS_ORIGINS` when empty |
| `SUPER_ADMIN_EMAIL` | `superadmin@projectname.com` | Seeded super admin |
| `SUPER_ADMIN_PASSWORD` | `SuperSecret@123` | The default must never reach production |
| `ENCRYPTION_ENABLED` | `false` | Transport encryption (see `FEATURES.md`, B10) |
| `ENCRYPTION_KEY` | *(empty)* | Exactly 64 hex chars when encryption is enabled |
| `CLOUDINARY_CLOUD_NAME` | *(empty)* | Empty = upload routes return 503 |
| `CLOUDINARY_API_KEY` | *(empty)* | Use the account-level **Root** key |
| `CLOUDINARY_API_SECRET` | *(empty)* | |
| `CLOUDINARY_FOLDER` | `projectname` | Top folder in the media library |
| `BREVO_API_KEY` | *(empty)* | When set, Brevo takes priority over SMTP |
| `BREVO_FROM_EMAIL` | *(empty)* | Must be a verified sender in Brevo |
| `BREVO_FROM_NAME` | `ProjectName` | |
| `BREVO_SENDER_NAME` | *(empty)* | Falls back to `BREVO_FROM_NAME` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | *(empty)* / `587` / `false` | Used when Brevo is not set |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | |
| `MAIL_FROM_NAME` | `ProjectName` | |
| `MAIL_FROM_EMAIL` | `no-reply@projectname.com` | |
| `MSG91_AUTHKEY` | *(empty)* | SMS provider |
| `MSG91_SENDER_ID` | *(empty)* | A DLT-registered sender is mandatory in India |
| `MSG91_TEMPLATE_ID` | *(empty)* | DLT template, `{{0}}` placeholder |
| `MSG91_COUNTRY_CODE` | `91` | |
| `FCM_SERVER_KEY` / `FCM_ENABLED` | *(empty)* / `false` | Push — no code reads them yet |
| `RAZORPAY_*` / `STRIPE_*` / `SHIPPING_PARTNER_WEBHOOK_SECRET` | *(empty)* | Safe to ignore until the payment gateway integration lands |

With no `BREVO_*` / `SMTP_*` set, OTP mail is dropped into the log.

**Local tooling** (`npm run db:up` and friends) reads raw `process.env`, outside the schema: `PGLITE_MODE`, `PGLITE_PORT`, `PGLITE_HOST`, `PGLITE_DATA_DIR`, `SEED_DEMO_DATA`.

**Rules enforced at boot**, whichever combination you set:

| Condition | Result |
| --- | --- |
| `QUEUE_ENABLED=true` + no `REDIS_URL` | boot error |
| `ENCRYPTION_ENABLED=true` + key not 64 hex | boot error |
| production + `*` in `CORS_ORIGINS` | boot error |
| `OTP_STATIC_CODE` set in production | boot error |
| `OTP_STATIC_CODE` not digits-only | boot error |
| production + `OTP_REQUIRED=true` + no delivery provider | boot error |

---

## Running locally

```bash
npm run dev     # watch mode
npm run build   # compile to dist/
npm start       # run the compiled output
```

### Health check

```bash
curl http://localhost:5000/api/v1/health
curl http://localhost:5000/api/v1/health/db
curl http://localhost:5000/api/v1/health/redis
curl http://localhost:5000/api/v1/health/queue
```

`/health` never touches the database, so it stays green even when Postgres is down — that is deliberate for uptime probes. Use `/health/db` to check the data layer.

### Registering an account

With the default `.env`, `OTP_STATIC_CODE=111111` and the code is printed in the server log instead of being emailed.

```bash
# 1. request the code
curl -X POST http://localhost:5000/api/v1/auth/register/sendOtp \
  -H "Content-Type: application/json" -H "x-device-id: dev" \
  -d '{"identifier":"you@example.com"}'

# 2. verify the code — returns a single-use verificationToken
curl -X POST http://localhost:5000/api/v1/auth/register/verifyOtp \
  -H "Content-Type: application/json" -H "x-device-id: dev" \
  -d '{"identifier":"you@example.com","otp":"111111"}'

# 3. register with the token
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" -H "x-device-id: dev" \
  -d '{"type":"CUSTOMER","name":"Your Name","email":"you@example.com","password":"Aa1!aaaa","verificationToken":"<from step 2>"}'
```

OTP login is the same shape in two steps: `POST /auth/sendOtp` with `{"type":"LOGIN"}`, then `POST /auth/login/verifyOtp` with the code, which verifies it and signs in in one call. Request and response examples are in Part F of `FEATURES.md`.

To skip the code while building, set `OTP_REQUIRED=false`. Do not ship that.

---

## Testing

```bash
npm run verify     # the gate: env:check + typecheck + lint + test
npm test           # unit + contract, no database needed
npm run e2e        # live HTTP suites against a real database
```

The live suites drive the real Express app through supertest against a live PostgreSQL database, so they assert behaviour rather than mocks. Every response is checked against the strict envelope (`status` / `message` / `result`, no `null` at any depth), and role boundaries are asserted explicitly.

| Suite | Covers |
| --- | --- |
| `e2e-smoke.ts` | auth: register / login / refresh / logout / RBAC |
| `e2e-user-vendor.ts` | profile, addresses, KYC, vendor approval, payout request |
| `e2e-product.ts` | catalogue CRUD, variants, images, stock, recommendations |
| `e2e-catalog.ts` | brands, tags, attributes, collections, categories |
| `e2e-cart.ts` | cart, coupons, wishlist |
| `e2e-order.ts` | cart-to-order split, state machine, cancellation, timeline |
| `e2e-payment.ts` | payment, refund, wallet, payout, return |
| `e2e-review.ts` | reviews, questions, coupons, flash sales |
| `e2e-shipping.ts` | zones, methods, partners, riders, settings, admin, API keys |
| `e2e-notification.ts` | notifications, chat, tickets |
| `e2e-analytics.ts` | tracking, analytics, funnels, search, uploads |
| `e2e-content.ts` | pages, blog, FAQ, banners, contact, geo, currency, tax, translations, dropdowns, webhooks, bulk import, reports |
| `e2e-engagement.ts` | loyalty, referrals, gift cards, message templates |
| `e2e-encryption.ts` | AES-256-GCM transport, maintenance mode |

Run an individual suite by path:

```bash
npx tsx scripts/e2e-order.ts
```

`scripts/run-e2e.ps1` runs one to completion in a single blocking call and prints only the summary plus any failures:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-e2e.ps1 -Script scripts/e2e-content.ts
```

The suites share one database. `loyalty.enabled`, `referral.enabled` and `giftCard.enabled` gate the engagement module, so `e2e-engagement.ts` pins those settings at the start and restores them in its cleanup. If a suite is killed mid-run, the settings can be left flipped; the next run resets them.

If the database is reset by anything else, `SUPER_ADMIN` disappears and every staff route returns 401. `npm run seed` is idempotent and restores it.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. `npm ci`
2. `npm run prisma:generate`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test`

The live e2e suites are **not** in CI — they need a real PostgreSQL and take several minutes, so they run locally.

Formatting is **not** a CI step: most of the tree predates the Prettier config, so `npm run format:check` would fail until the whole repo is reformatted in one pass. It is enforced per-commit by `lint-staged` instead.

### Git hooks

`pre-commit` runs `lint-staged`, which formats and lints the staged files only, so a commit cannot introduce a formatting or lint failure. Configured in `.lintstagedrc`, wired up by the `prepare` script that `npm install` runs.

`typecheck` and the unit tests are deliberately **not** in `pre-commit` — they take long enough to make committing unpleasant. `npm run verify` covers both, and CI enforces them.

---

## OTP

How OTP behaves — the master switch, `verificationToken`, throttling, password history and the rest — is documented in Part B of `FEATURES.md`. The operational side is here.

`OTP_REQUIRED` is the single switch. `true` (default) is the secure choice; it is not enforced when no channel can deliver a code, so a fresh clone with no provider is not locked out of its own login screen. In `NODE_ENV=production` that combination is a boot error instead.

### Delivery

**You do not need a provider to build.** With nothing configured, `sendOtp` still returns 200 and the code is written to the application log. Pair that with `OTP_STATIC_CODE=111111` and the whole signup flow works offline.

| Channel | Provider | Setup | Free tier |
| --- | --- | --- | --- |
| Email | **Brevo** (`BREVO_API_KEY`) | verified domain, DNS, company details | 300/day |
| Email | any SMTP host | credentials from its dashboard | varies |
| SMS | **MSG91** (`MSG91_AUTHKEY`) | DLT sender + template in India | ~5,000 |

Brevo takes priority over SMTP when both are set. Set `OTP_SMS_ENABLED=true` to deliver codes to phone numbers — in India a DLT-registered sender id and template id are mandatory.

`OTP_STATIC_CODE` pins the code for local work. It is not a bypass: the value is still hashed, still expires in 10 minutes and is still capped at 3 attempts and one resend per minute.

---

## Media storage

Images, video and KYC PDFs go to **Cloudinary** — never to Render's disk, which is ephemeral and loses everything on every deploy and restart. A request is written to `uploads/tmp/`, streamed to Cloudinary, and the temp file is unlinked in a `finally`.

Folders default to `CLOUDINARY_FOLDER/<kind>`; an upload may override them with a `folder` field in the request body.

| Upload | Destination folder |
| --- | --- |
| Product images | `projectname/products` |
| Vendor KYC | `projectname/kyc/<docType>` |
| Generic / chat media | `projectname/<kind>` |

Without the three `CLOUDINARY_*` variables the API starts fine but every upload route returns 503, and `GET /api/v1/uploads/getSignedUrl` reports `enabled: false`.

---

## Seeded logins

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | `superadmin@projectname.com` | `SUPER_ADMIN_PASSWORD` (default `SuperSecret@123`) |
| SUB_ADMIN | `subadmin@projectname.com` | `Demo@12345` |
| VENDOR | `vendor@projectname.com` | `Demo@12345` |
| CUSTOMER | `customer@projectname.com` | `Demo@12345` |

Seeding is idempotent — every write is an `upsert`, so re-running never duplicates rows and never clobbers a setting an admin has changed.

The super admin's password is set on first seed only. Changing `SUPER_ADMIN_PASSWORD` later does not update the row already in the database.

---

## Endpoints

- API — `http://localhost:5000/api/v1`
- OpenAPI JSON — `http://localhost:5000/api/v1/docs.json`
- Health (Render probes this) — `http://localhost:5000/api/v1/health`

The full route list, with auth and role per endpoint, is Part E of `FEATURES.md`; the generated spec at `GET /api/v1/docs.json` is the authoritative contract.

---

## Deployment (Render)

`render.yaml` is the source of truth — create the service with **New → Blueprint** and point it at this repo. Every `sync: false` value is filled in the dashboard.

- Build: `npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run seed && npm run build`
- Start: `npm start`
- Health check path: `/api/v1/health`

`--include=dev` is required. `render.yaml` sets `NODE_ENV=production`, which npm turns into `omit=dev`, and `prisma` / `typescript` / `tsx` are all devDependencies. Do **not** add `--ignore-scripts` — bcrypt pulls its native binary in an install script.

`migrate deploy` only creates the schema. `npm run seed` is what inserts the super admin, the settings and the permission matrix — on a fresh database you need both. The seed is idempotent, so it is safe on every deploy.

| Dashboard value | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Render Postgres → **Internal** Database URL |
| `REDIS_URL` | Render Key Value, or Upstash / Redis Cloud |
| `CORS_ORIGINS` | Your frontend, e.g. `https://app.yourdomain.com` |
| `SUPER_ADMIN_PASSWORD` | Anything but the built-in `SuperSecret@123` |
| `CLOUDINARY_*` | Cloudinary → Settings → API Keys (Root key) |
| `BREVO_API_KEY` or `SMTP_*` | Required while `OTP_REQUIRED=true`, else the boot is refused |
| `MSG91_*` + `OTP_SMS_ENABLED` | Only if you enable SMS |

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are generated by the blueprint. Set `PGLITE_MODE=false` in production.

Migrations live in `prisma/migrations`. Never edit an already-applied folder in place — add a new dated folder (details in `AGENTS.md`).

> The free Render Postgres plan is deleted 30 days after creation, data included. Upgrade before it expires.

---

## Diagnosing

```bash
npm run doctor
```

One screen covering everything that fails silently (the numbers are an example):

```
[PASS] database       reachable
[PASS] postgres       PostgreSQL 18.6
[PASS] tables         <n>
[PASS] migrations     <n> applied, all present on disk
[FAIL] smtp           not configured — every sendOtp is dropped
[WARN] redis          not set — jobs dropped
```

It also flags weak secrets, `.env` files tracked by git, and the case where OTP is required but nothing can deliver a code. Use `LOG_LEVEL=debug` for server logs.

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Cannot find module 'dist/server.js'` | Wrong tsconfig. Run `npm run build`; the entry is `dist/server.js` |
| `[env] Invalid environment variables` | The schema rejects it on purpose and names the variable. Usually a missing `DATABASE_URL`, a `JWT_*_SECRET` under 16 chars, or `QUEUE_ENABLED=true` with no `REDIS_URL` |
| `OTP_STATIC_CODE ... must never be set in production` | Empty that variable on Render |
| `OTP_REQUIRED=true in production needs a delivery provider` | Set `BREVO_API_KEY` / `SMTP_*` / `MSG91_*`, or set `OTP_REQUIRED=false` while still building |
| Login fails with `ACCOUNT_UNVERIFIED` | The account was created with `OTP_REQUIRED=false` and never verified. Re-run `npm run seed`, or verify the contact through `POST /auth/verifyEmail` |
| `bcrypt` fails to load | Its native binary is missing. Do not pass `--ignore-scripts`; run `npm install` without it |
| Every route 500s but `/health` is UP | `/health` never touches the database on purpose. Check `/health/db`, then `npm run doctor` |
| Rate limited while testing | `RATE_LIMIT_ENABLED=false` — note this also removes the 1-per-minute OTP send guard |
| `42P05 already exists` against PGlite | Named prepared statements collide; use `pgbouncer=true&connection_limit=1` (Option C) |

---

## Where to add what

| You are adding | Add it here |
| --- | --- |
| A new tech dependency | This file, Tech stack |
| A new env var | `src/config/env.config.ts`, then `.env.example` (`npm run env:sync`), then this file's env table |
| A new command | This file, Commands, plus `package.json` |
| A new model or route prefix | `prisma/schema.prisma`; this file's Data model / route mapping |
| A new feature, business rule, config default or edge case | `FEATURES.md`, in the matching part |
| A new endpoint | The module itself, then `FEATURES.md` Part E |
| A new code rule or worked example | `AGENTS.md` |
| A new troubleshooting case | This file, Diagnosing |
