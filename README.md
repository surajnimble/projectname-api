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
- Redis (Upstash / Redis Cloud) — cart sessions, cache, rate-limit store, realtime analytics streams
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

**Deployment**

- - Docker — builds the `linux/amd64` image locally or in Workers Builds
- `
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
│   ├── worker.ts         # forwards requests, keeps one container instance warm
│   ├── tsconfig.json     # Worker-only typecheck (Workers types, no Node libs)
│   └── entrypoint.sh     # migrate → seed-if-empty → node dist/server.js
├── tests/                # vitest
├── .github/workflows/    # CI
├── .env, .env.example    # .env.example is generated — npm run env:sync
├── .dockerignore
├── .gitattributes
├── .nvmrc
├── Dockerfile            # linux/amd64 image for ├── ├── tsconfig.json         # typecheck + eslint (scripts and tests included)
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
| `npm run maintenance:off` | Kill switch — clears `maintenanceEnabled` in the DB and the Redis cache, no login needed |


