# Features and API Reference

The canonical reference for what the API does: its features, business rules, behaviour configuration and defaults, edge-case behaviour, endpoints and sample requests.

- Setup, tech stack, commands, deployment and troubleshooting → [`README.md`](README.md)
- How to change the code (module shape, response format, naming, comments, DO's and DON'Ts) → [`AGENTS.md`](AGENTS.md)
- The exact endpoint contract → `GET /api/v1/docs.json` (generated from the live router; when this document and the spec disagree, the spec is right)

**Where to add what:** a new feature goes under the relevant category in Part A, a new business rule in Part B, a new default in Part C, a new error case in Part D, a new endpoint under its module in Part E.

## Contents

- [Part A — Features](#part-a--features)
- [Part B — Business rules and behaviours](#part-b--business-rules-and-behaviours)
- [Part C — Configuration and defaults](#part-c--configuration-and-defaults)
- [Part D — Edge cases and error behaviour](#part-d--edge-cases-and-error-behaviour)
- [Part E — Endpoints](#part-e--endpoints)
- [Part F — Sample requests and responses](#part-f--sample-requests-and-responses)

---

## Part A — Features

### A1. Platform and infrastructure

- **API versioning** — everything lives under `/api/v1/...`, so future breaking changes can ship as a new version.
- **RBAC middleware** — roles `SUPER_ADMIN`, `SUB_ADMIN`, `VENDOR`, `CUSTOMER`, `DELIVERY_BOY` protect routes. The `VENDOR` role is assigned through `/auth/register` with `type=VENDOR`. Role → permission mapping lives in the `RolePermission` table.
- **Multi-tenancy scoping** — a `vendorId` filter on every vendor query (Prisma `$extends`), so a vendor only ever sees their own data.
- **Rate limiting** — Redis-backed store, so counters do not reset on server restart.
- **CORS whitelist** — admin, vendor and store domains only; no wildcard `*`. Sockets use a separate whitelist (`SOCKET_CORS_ORIGINS`).
- **Central error handler** — `AppError` plus the `errorHandler` middleware produce one consistent JSON error shape.
- **Async wrapper** — `asyncHandler(fn)` removes try/catch repetition in controllers.
- **Request ID middleware** — `req.id` via `nanoid`, so every log line of one request can be traced; returned in the `X-Request-Id` header.
- **Health route** — `/api/v1/health` for uptime probes (Render). It never touches the database; `/health/db`, `/health/redis` and `/health/queue` check the layers.
- **Graceful shutdown** — on SIGTERM: Prisma disconnect, Redis quit and Socket close, so no data is lost.
- **BullMQ queues** — email, payout calculation, order status, analytics aggregation and notification blast run in the background so responses stay fast.
- **Email templates** — reusable HTML templates (order confirmation, password reset); the files in `src/templates/` are the fallback when no DB template row exists.
- **File upload validation** — MIME and size are checked in multer; malicious files are rejected.
- **Pagination standard** — `?page=1&limit=20&sort=-createdAt&search=` on every list endpoint.
- **Soft delete** — `deletedAt` on Vendor, Product and Order keeps data recoverable.
- **Audit logs** — the `AuditLog` table records which sub-admin did what; SUPER_ADMIN self-edits are also logged.
- **DB indexes** — on email, slug, vendorId, status and createdAt.
- **Seed script** — Super Admin, settings, permission matrix and demo data in one idempotent command.
- **Migration in build** — `prisma migrate deploy` runs in the Render build, so the schema syncs automatically.
- **Env validation** — a Zod env schema stops the server early on a missing or invalid value.
- **Swagger `/docs`** — auto-generated OpenAPI so frontend developers can read the contract.
- **`.env.example`** — documents every env var; generated with `npm run env:sync`.
- **Realtime layer** — Socket.io for chat, live order tracking and the live analytics dashboard.
- **Feature flags** — `SystemSetting` rows with `category=feature`; clients fetch them at boot.
- **Maintenance mode** — when an admin turns it on, the API answers 503 except `/health`, `/docs` and `/admin/*` (for SUPER_ADMIN).
- **PDF generation** — invoice, packing slip and payout statement (`pdfkit`).
- **Geo serviceability** — pincode → serviceable check, per vendor or zone.
- **Bulk import/export** — CSV/Excel endpoints for products, orders and users.
- **Webhook stubs** — payment gateway, shipping and Razorpay webhooks, plus the `COD`, `UPI` and `Bank Detail` payment flows.
- **Encrypted request and response** — optional AES-256-GCM transport, toggled by `ENCRYPTION_ENABLED` (see [B10](#b10-encrypted-transport)).

### A2. Security and identity

- **Refresh token strategy** — access token 15 minutes, refresh token 7 days. The refresh token is stored (hashed) in the DB, is revocable and travels in an HttpOnly cookie; the access token is returned in the response body.
- **OTP verification** — proof of contact before an account exists. `OTP_REQUIRED` switches the whole system on or off. See [B1](#b1-authentication-and-otp).
- **OTP delivery** — Email (Brevo or SMTP) through `src/services/mail/` and SMS (MSG91) through `src/services/sms/`.
- **2FA TOTP** — HMAC-SHA1 TOTP implemented in `src/utils/crypto.ts`, optionally enabled per user; `qrcode` generates the setup QR.
- **Session management** — `Session` rows in Postgres with device-wise revoke.
- **Tracking middleware and device fingerprint** — device, geo and session are captured on every incoming request in the background; `ua-parser-js` plus a client-generated `deviceId` identify a device uniquely.
- **KYC / document upload** — vendor GST / PAN / Aadhaar verification flow.
- **Social login** — Google, Apple and Facebook; link and unlink supported.
- **Account security rules** — password history and expiry, concurrent session limit, contact change, deletion recovery window, sign-in alerts ([B2](#b2-account-security)).
- **Customer ban rules** — block a customer with a reason and optional expiry ([B3](#b3-customer-management)).
- **DPDP data export and consent log** — self-service export and a terms/privacy/marketing consent audit trail ([B3](#b3-customer-management), [B1](#b1-authentication-and-otp)).
- **Login notification rules** — in-app and email alert on every successful sign-in ([B2](#b2-account-security)).
- **Encrypted request and response** — [B10](#b10-encrypted-transport).

### A3. Commerce and marketplace

- **Order state machine** — the main path is `PENDING → CONFIRMED → SHIPPED → DELIVERED`, ending in `CANCELLED` or `RETURNED`. The full status set is `PENDING`, `PENDING_TOKEN`, `CONFIRMED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `RETURNED`. Random transitions are blocked (`422 INVALID_STATUS_TRANSITION`).
- **Inventory management** — stock is decremented inside a transaction, so nothing oversells.
- **Multi-vendor cart split** — placing an order creates one `SubOrder` per vendor, and each vendor sees only their part.
- **Payout and commission** — earnings = order total − commission − fee; vendor payouts are calculated from that.
- **Currency and tax config** — per-vendor GST / tax configuration, so tax is applied vendor-wise.
- **Catalog and order rules** — product condition, warranty, non-returnable items, review edit window, order tags, delivery instructions, order internal notes ([B4](#b4-catalog-and-orders)).
- **Cart rules** — gift wrap, per-item delivery note, save for later, price drop alerts ([B5](#b5-cart)).
- **Payment rules** — partial and repeated refunds, idempotency keys ([B6](#b6-payments)).
- **Token payment / advance** — a token amount at order time, the balance due later, auto-cancel when the balance is not paid ([B4](#b4-catalog-and-orders)).
- **Vendor rules** — storefront, own coupons, bulk order actions, vacation mode, customer blocklist ([B7](#b7-vendors)).

### A4. Domain modules

| Module | What it covers |
| --- | --- |
| Users | profile, addresses, activity, orders, timeline, notes, bans, segments, DPDP export, impersonate |
| Vendors | profile, stats, products, ratings, payout history, KYC documents, storefront, vacation, announcements, blocked customers |
| Admin / sub-admin / permissions | dashboard, sub-admins, permissions, audit logs, system health, cache, cron, failed jobs |
| Products | create, update, stock, images, bulk operations, CSV import/export, filters, recommendations |
| Categories / brands / tags / attributes / collections | catalog management |
| Cart / wishlist / price watches | cart operations, saved for later, wishlist, price watch |
| Orders | place, cancel, track, invoice, packing slip, shipping label, timeline, returns |
| Payments / payouts | pay token, pay balance, UPI, bank, COD, refund, Razorpay, Stripe, payouts |
| Wallet | balance, transactions, top-up, redeem |
| Loyalty | points, history, redeem, tiers |
| Referral | code, apply, rewards, leaderboard |
| Gift cards | create, redeem, balance, disable |
| Returns / refunds | request, approve, reject, pickup, received, refund |
| Reviews / Q&A | add, update, approve, reject, vote, reply, ask, answer |
| Coupons / flash sales | create, validate, apply, usages, toggle |
| Shipping | zones, methods, partners, shipments, tracking, serviceability, delivery boys |
| Support / chat / tickets | conversations, messages, tickets, canned responses |
| Notifications | in-app, email, SMS, push, preferences, templates |
| Content | pages, blogs, FAQs, banners, contact, newsletter, dropdowns |
| i18n / currency / tax / country | translations, locales, conversion, tax configs, states, cities, pincode |
| API keys / webhooks | create, revoke, usage, register, logs, rotate secret; Razorpay, shipping and generic payment-gateway webhooks |
| Bulk jobs / reports | import products, orders and users; job status; reports; schedules |
| Tracking and analytics | events, page views, sessions, devices, crashes, funnels; daily Redis counters and a BullMQ nightly rollup into Postgres |
| Devices | list, block, unblock, trust, untrust, delete |
| Search | global, autocomplete, products, vendors, trending, recent |
| Uploads | image, video, document, multiple, delete, signed URL |
| Audit logs / activity logs | list, detail, actor, export, purge |
| Settings | public, all, update, bulk update, category, reset, feature flags, maintenance |
| System / version / health | version; health for db, redis and queue; job state |

---

## Part B — Business rules and behaviours

Rules that cannot be read off the schema or the endpoint list.

### B1. Authentication and OTP

**One table, one switch.** OTPs live in a single table with `type` and `channel` columns:

- `POST /auth/sendOtp` → `{ type, channel, identifier }`
- `POST /auth/verifyOtp` → `{ type, identifier, otp }`
- `POST /auth/register/sendOtp` → `{ identifier }`
- `POST /auth/register/verifyOtp` → `{ identifier, otp }` → `verificationToken`
- `POST /auth/login/verifyOtp` → `{ identifier, otp }` → session

A record is keyed by the channel the identifier implies (`EMAIL` for an email address, `SMS` for a phone number), not by the channel the client asked for — so an SMS code cannot be redeemed as though it arrived by email. A code is only ever valid for the identifier it was sent to.

**Where a code is used:** registration, OTP login, forgot/reset password, email and phone verification, and password change.

**`OTP_REQUIRED` is the master switch.** Every enforcement point reads it through `src/config/otp-policy.ts`, never straight from `ENV.OTP_REQUIRED`, so toggling it cannot leave one code path still demanding a code.

| Value | Register | Login | Change password |
| --- | --- | --- | --- |
| `true` (default) | demands a `verificationToken`; the row is written only after the token is spent | refuses an account with no verified contact — 403 `ACCOUNT_UNVERIFIED` | needs a code sent to the account's own contact |
| `false` | creates the account immediately, unverified | skips the verification check | current password only |

`true` is the default because it is the secure choice. It is not enforced when no channel can deliver a code, so a fresh clone with no provider is not locked out of its own login screen. In `NODE_ENV=production` that combination is a **boot error** instead — promising codes you cannot send is a deploy mistake, not a runtime condition.

**`verificationToken` (register only).** A single-use token is needed whenever another request sits between "code verified" and "the real action" — registration, where the details arrive in step 3. Login has no such gap: the code and the session arrive in the same request (`POST /auth/login/verifyOtp`), so no token is needed there.

The token lives in the `AuthVerification` table and holds three things:

| Field | Why it matters |
| --- | --- |
| `purpose` | what the token is for — a token for one job does not work for another (a register token cannot log in) |
| `identifier` | the exact email/phone whose code was entered — step 3 cannot submit a different contact (400 `VERIFICATION_IDENTIFIER_MISMATCH`) |
| `usedAt` | single use — sending it again is 401 `VERIFICATION_INVALID` |

Only the SHA-256 of the token is stored, never the plain text; `expiresAt` is 15 minutes. Spending it is a conditional `UPDATE` (`usedAt: null` + `expiresAt` in the future + matching purpose), so of two simultaneous requests only one wins. The identifier-mismatch check runs **before** the token is spent, so a wrong identifier does not burn a valid token. Configured in `src/config/verification.config.ts` (`TTL_MIN`, `TOKEN_BYTES`).

Step 2 only checks the code — no account is created and no session is issued. Only the contact whose code was entered is marked verified: registering by email leaves `isPhoneVerified` false until `POST /auth/verifyPhone`. A code is single-use; sending the same code again is 401 `OTP_INVALID`.

**Throttling is in the database.** The resend cooldown (60 s) and the daily cap (10) are counted on the `Otp` row (`lastSentAt`, `sendDay`, `sendCount`), not in Redis — with Redis down the limit would otherwise disappear. Redis is only a cross-instance accelerator; its being unavailable never stops a code from being sent.

**`OTP_STATIC_CODE`** pins the code for local work. It is not a bypass: the value is still hashed, still expires in 10 minutes and is still capped at 3 attempts and one resend per minute. The env schema refuses it in production.

**Delivery.** Brevo (HTTP API) takes priority over SMTP when both are set; MSG91 delivers SMS when `OTP_SMS_ENABLED=true`. With no provider configured `sendOtp` still answers 200 and the code goes to the log (`npm run doctor` fails on this). Provider setup is in the README.

**Password history.** `security.passwordHistoryCount` (default `3`) is how many previous hashes are kept per user in `PasswordHistory`. `POST /auth/changePassword` and `POST /auth/resetPassword` both push the outgoing hash into that table and refuse a new password that matches the live hash or any retained one — 422 `PASSWORD_REUSED`. A count of `0` turns the check off. The trim runs in the same transaction as the write, so the retained set is a ceiling, not a backlog.

**Consent / terms acceptance.** The `UserConsent` table logs when a user accepts `TERMS`, `PRIVACY` or `MARKETING`. `POST /auth/acceptConsent` writes a row with type, version, IP and user-agent; `GET /auth/getMyConsents` returns every accepted consent. A unique constraint on `(userId, type, version)` prevents duplicate accepts. This is the DPDP audit trail.

**Password login response.** `POST /auth/login` takes only a password (`email` or `phone`, either works) — no `otp` or `type` field; OTP login is the two-step flow above. If `twoFactorRequired: true` comes back, the tokens are empty and a `twoFactorToken` is returned, to be sent to `POST /auth/verify2FA`. `revokedSessionCount` says how many older sessions were closed by the session cap (`0` by default).

### B2. Account security

**Password expiry.** `User.passwordChangedAt` is stamped at registration and on every successful `changePassword` / `resetPassword`. When `security.passwordExpiryDays` is greater than `0`, a password older than that blocks `POST /auth/login` with 403 `PASSWORD_EXPIRED`. The default `0` means passwords never expire. OTP login is unaffected, since there is no password to expire.

**Concurrent session limit.** `security.maxActiveSessions` (`0` = unlimited) is enforced inside `issueTokens` on every sign-in. Once a user is at the cap, the oldest sessions by `lastSeenAt` are closed and their refresh tokens revoked; the session that just signed in is always kept. The login response returns `revokedSessionCount` so the client can say how many devices were signed out.

**Contact change.** Changing the sign-in email or phone is a two-step flow, and the code always goes to the contact being *claimed*, never the current one. `POST /auth/changeEmail/sendOtp` sends it (rate limited by `PASSWORD.CONTACT_CHANGE_COOLDOWN_MIN` per target address), `POST /auth/changeEmail/verifyOtp` returns a single-use `verificationToken`, and `POST /auth/changeEmail` / `POST /auth/changePhone` need both. On success the new contact is marked verified and **every** refresh token is revoked, so a takeover cannot ride along on an existing session. The account is notified of the swap afterwards.

**Deletion recovery window.** `DELETE /users/deleteAccount` does not destroy anything outright: it sets `deletedAt`, releases the email and phone, and stamps `purgeAfter` at `security.accountPurgeDays` (default `30`). The restore token is emailed at that moment and stored only as a hash, so `POST /auth/restoreAccount` matches on `deletionTokenHash` — the released contacts cannot identify the row. The `purge-deleted-accounts` cron deletes accounts whose window has closed, and restore returns 410 `ACCOUNT_PURGE_WINDOW` once it has.

**Sign-in alerts.** A login from a device the account has not used before raises an in-app `ALERT` notification with the IP and platform, controlled by `security.loginAlerts` and `security.newDeviceAlerts`. The first-known device is recorded at that moment, so the alert fires once per device rather than once per login. `User.lastLoginIp` tracks the previous IP for location comparison.

**Login notifications.** Every successful sign-in sends the customer an in-app notification plus an email with the device, IP, geo location and whether the device is new.

| Setting | Default | Purpose |
| --- | --- | --- |
| `security.loginNotifyEnabled` | `true` | master switch |
| `security.loginAlerts` | `true` | send the email |

This extends the existing new-device alert path rather than replacing it: the result of `flagNewDevice` goes into `data.isNewDevice` and is not recomputed. `notifyLogin` is called from one place for every path — password, OTP, 2FA, social. `rotateRefreshToken` deliberately does not call it, because token rotation is not a sign-in. The notification is advisory: the whole body is wrapped in try/catch, a failure is logged, and the login never breaks. `loginNotifyEnabled` is part of `getSecurityConfig()`, so it costs no extra settings round-trip.

### B3. Customer management

**Customer bans.** `CustomerBan` has **one** row per user (`userId @unique`), so a customer is either banned or not. `reason` is mandatory — a block without a reason leaves no record — and the same reason is shown to the customer in `exportMyData`.

| Field | Meaning |
| --- | --- |
| `reason` | why the customer was blocked; visible to the customer in the DPDP export |
| `expiresAt` | `null` = permanent; set from `durationDays`, clamped to `security.banMaxDays` |
| `revokedAt` | set when an admin lifts the ban with `unbanCustomer` |
| `revokeReason` | the reason given for the unban |

- **Expiry is evaluated at runtime**, not from a stored column: `isBanActive(ban)` checks both `revokedAt` and `expiresAt` against the clock, so an expired ban stops applying at read time without waiting for a cron.
- **`isActive` is the cron's job.** `banCustomer` deactivates the account, so `lift-expired-bans` (`*/10 * * * *`) sets `revokedAt` on expired bans **and** turns `isActive` back on. If that cron did not run the customer would stay locked out forever, which is why it runs every 10 minutes.
- **The ban is checked at sign-in, after the credentials are verified.** Checking it before `INVALID_CREDENTIALS` would let a wrong password return `ACCOUNT_BANNED` and tell an attacker the account exists. `assertNotBanned` sits in every sign-in path (password, OTP, 2FA, social) just before tokens are issued.

| Situation | Result |
| --- | --- |
| Admin bans themselves | 403 `FORBIDDEN` |
| Ban without `durationDays` | `expiresAt: null`, permanent |
| Expired ban, cron not yet run | ban inactive; `isActive` restored on the cron's next run |
| Unban of a customer who was never banned | 404 `NOT_FOUND` |
| Banned customer signs in | 403 `ACCOUNT_BANNED`, with the days remaining inside the message |

**Customer segments.** Two kinds of segment live in one table:

| `kind` | Managed by | Membership |
| --- | --- | --- |
| `MANUAL` | an admin, by hand | `source: MANUAL`, `assignedById` set |
| `NEW`, `REPEAT`, `VIP`, `WHOLESALE`, `BLOCKED` | the `refresh-customer-segments` cron | `source: RULE` |

The `source` column *is* the rule. Automatic members have `source: RULE` and manual ones `source: MANUAL`, so a refresh never touches a manual assignment. For the same reason `addSegmentMembers` / `removeSegmentMembers` on an automatic segment answer 403 `CUSTOMER_SEGMENT_KIND_LOCKED` — the admin's work would be overwritten overnight.

- **Refresh is a full recompute, not a diff.** Every customer's orders come back in one grouped query, the qualifying kinds are derived, then the `RULE` rows are replaced. It is a batch loop, not a per-customer loop: `customer.segment.batchSize` (500) customers per pass, by `id` cursor.
- **The segment row is created before its members.** `ensureAutoSegments()` creates any missing kind on every run — if an admin deletes the VIP segment it comes back empty, and the rule does not go silent.
- **Definitions** (`evaluateSegmentKinds`, `src/utils/segments.ts`):

| Kind | Rule |
| --- | --- |
| `NEW` | `orderCount === 0` |
| `REPEAT` | `deliveredOrderCount >= customer.segment.repeatOrders` (2) |
| `VIP` | `totalSpent >= customer.segment.vipSpend` (10000) |
| `WHOLESALE` | `deliveredOrderCount >= customer.segment.wholesaleOrders` (10) |
| `BLOCKED` | has an active ban |

`REPEAT` and `WHOLESALE` count **delivered** orders, not placed ones — otherwise a single cancelled order would make a repeat buyer. Kinds are a list, not a flag: one customer can be both VIP and REPEAT.

- **A corrupt threshold produces an empty segment, not everyone.** A setting value that is `NaN` or below `1` is treated as unusable and the comparison fails. Falling back to `1` would put every customer with an order into every segment.
- The cron runs at `0 6 * * *`. The same routine runs from `POST /users/refreshSegments`, so an admin does not have to wait.

**Customer timeline.** `GET /users/getTimeline/:id` merges five streams — `ORDER`, `RETURN`, `TICKET`, `CHAT`, `LOGIN` — into one ordered list so a support agent does not need five screens. `?type=` filters to one stream; `?from=` / `?to=` set a range. It is **read-only** and uses no new table. `getUserActivity` is separate: it reads only the `ActivityLog` event stream, not business objects.

The union is not done in SQL. Prisma applies `skip`/`take` to a single table and you cannot know where the page boundary falls before merging, so each source returns **`skip + limit`** rows — the first `skip + limit` rows of the union are fully contained in that, and the slice is correct. Consequences:

- Past `TIMELINE_MAX_WINDOW` (200), a deep page does not get that many rows from each source and the list can be shorter than the page. This is deliberate — without a cap a deep page would become five unbounded queries.
- `totalRecord` is the sum of each source's own `count()`, so it exceeds the merged window. That is expected: the count is accurate, the list is inside the window.

**DPDP data export.** `GET /users/exportMyData` (self) and `GET /users/exportData/:id` (admin) are built by the same service, `exportCustomerData()`.

- **Secrets are never selected.** Password hash, 2FA secret, backup codes and refresh-token hashes are not in the query's `select`, so no serializer can leak them — the omission happens before serialization. `twoFactorEnabled` (boolean) is exported, the secret is not.
- **The ban is visible to the customer, notes are not.** `profileData.banData` carries the reason and expiry — under DPDP the customer has to be able to learn they were blocked. Internal `CustomerNote` rows are never exported; they are another person's free text.
- **The notification tail is capped** (`EXPORT_NOTIFICATION_LIMIT`, 200). Everything else is full history — sending every notification a customer ever received would be an unbounded response.
- The export returns `exportedAt`, `profileData`, `statsData` and the lists, with keys ordered per the envelope rule (singles, then objects, then arrays).

### B4. Catalog and orders

**Product condition and warranty.** `Product.condition` is one of `NEW` / `USED` / `REFURBISHED` / `OPEN_BOX` and defaults to `NEW`. `warrantyMonths` is capped at `WARRANTY.MAX_MONTHS`, and `0` means no warranty is offered. They are all set through the same product create and update payload, and the CSV bulk-import schema carries them too.

**Non-returnable items.** `Product.isNonReturnable` is read from the **live product**, not from a copy on the order line, so a seller who changes the policy after a purchase still governs what may be sent back. `POST /returns/createRequest` answers 422 `NON_RETURNABLE` when any requested line belongs to such a product.

**Review edit window.** `review.editWindowDays` (default `7`) bounds `PATCH /reviews/updateReview/:id`; past it the call is 422 `EDIT_WINDOW_PASSED`. `0` disables the window.

**Order tags.** An order carries at most `WARRANTY.MAX_TAGS_PER_ORDER` labels. Labels are upper-cased and unique per order, so re-posting an existing one updates its colour instead of failing. All three tag routes are admin-only and accept an order id *or* an order number in the `:id` segment.

**Delivery instructions.** `Address.deliveryInstructions` travels with the address everywhere it is echoed — order detail, packing slip and the checkout address preview.

**Order internal notes.** The `OrderNote` table lets admin and vendor attach private comments to an order. `POST /orders/addNote/:id` adds a note with the caller's `userId` and IP; `GET /orders/getNotes/:id` lists them newest-first; `DELETE /orders/removeNote/:id/:noteId` removes one. Notes are never shown to the customer and appear in the order detail alongside tags and the timeline.

**Token payment / advance.** The customer pays a small token amount (fixed or a percentage of the order) to place the order, and pays the balance on delivery or within N days. Controlled by the `payment.token.*` settings ([Part C](#c3-systemsetting-defaults)).

1. Cart value ≥ `payment.token.applicableAbove` → a token is required.
2. Token amount = `mode === "percent"` ? `total * percent / 100` : `fixedAmount`, clamped between `minAmount` and `maxAmount`, and never above the order total.
3. The customer pays the token through one of `allowedMethods` → the order becomes `CONFIRMED` (until then it is `PENDING_TOKEN`).
4. The remaining balance is paid at delivery or within `balanceDueDays`.
5. Cancelling within `cancelWindowMin` refunds `refundPercent` of the token.
6. If the balance is not paid within `balanceDueDays`, the order is auto-cancelled and the token is forfeited (`forfeitOnNoPay`, `autoCancelAfterDue`).

```ts
function calcTokenAmount(orderTotal: number, cfg: {
  mode: 'percent' | 'fixed';
  percent: number;
  fixedAmount: number;
  minAmount: number;
  maxAmount: number;
  applicableAbove: number;
}) {
  // Rule 1: order total below applicableAbove → token not required
  if (orderTotal < cfg.applicableAbove) return 0;

  // Rule 2: compute the raw amount
  const raw = cfg.mode === 'percent'
    ? (orderTotal * cfg.percent) / 100
    : cfg.fixedAmount;

  // Rule 3: clamp between min and max
  const clamped = Math.min(Math.max(raw, cfg.minAmount), cfg.maxAmount);

  // Rule 4: never exceed the order total
  return Math.min(clamped, orderTotal);
}

// Examples (percent = 20, minAmount = 50, maxAmount = 5000, applicableAbove = 2000):
// orderTotal = 2000, mode = 'percent'      → 400
// orderTotal = 2000, mode = 'fixed' (100)  → 100
// orderTotal = 500                         → 0     (token not required)
// orderTotal = 20000, mode = 'percent'     → 4000  (inside the min/max clamp)
// orderTotal = 40000, mode = 'percent'     → 8000, clamped to maxAmount = 5000
```

The response of a token order is shown in [Part F](#token-order-response).

### B5. Cart

**Gift wrap.** `CartItem.isGiftWrap` is per line, and the charge is `cart.giftWrapCharge` (default `49`) counted once per wrapped line — not per unit, so three units of one wrapped product still cost one wrap. It lands as `giftWrapAmount` on both the cart totals and `Order`, and `placeOrder` recomputes it from the lines it is actually fulfilling, so a line dropped for stock does not leave the customer paying for its wrap. Turning the flag off clears the note rather than leaving it orphaned. `cart.giftWrapNoteMaxLength` bounds the note.

**Per-item delivery note.** `CartItem.deliveryNote` is distinct from `Address.deliveryInstructions`: the address note applies to the whole delivery, this one to a single line. Both survive onto `OrderItem`, so the packing slip and the order detail show the line-level note next to the item it belongs to.

**Save for later.** `SavedCartItem` is a separate table rather than a flag on `CartItem`. That is deliberate — nothing that totals, checks out, counts against `cart.maxItems` or holds stock can see a saved line, which a flag could not guarantee. Saving *moves* the line out of the cart rather than copying it. `POST /cart/savedForLater/:id/moveToCart` takes an optional `qty`; a partial move leaves the remainder saved, and the saved row goes only when the quantity reaches zero.

**Price drop alerts.** `PriceWatch` stores `targetPrice` plus the `lastSeenPrice` the last scan saw. The `price-drop-scan` cron compares the two and notifies only when the price has actually fallen *and* is at or below target — so an already-cheap watch stays quiet instead of re-notifying on every pass. The target must be below the current price at creation. `POST /priceWatches/watch` takes a variant id, in which case the variant price is watched; `0` means "any drop".

### B6. Payments

**Partial and repeated refunds.** `POST /payments/refund/:id` takes an optional `amount`; omitting it refunds whatever is left. The cap is always `paidAmount − (sum of already-settled refunds)`, re-read at initiation, and exceeding it is 422 `REFUND_EXCEEDS_PAID`. `Payment.status` and `Order.paymentStatus` only move to `REFUNDED` when the settled total reaches `paidAmount`; until then they sit at `PARTIALLY_REFUNDED`. There is no limit on how many refunds one order can carry — `GET /payments/getRefundHistory/:orderId` lists them all.

**Idempotency keys.** Money-moving routes accept an `Idempotency-Key` header: `payToken`, `payBalance`, `verifyUpi`, `verifyBank`, `markCodCollected`, `confirmPayment` and `refund`. The header is **optional** — without it the request behaves exactly as before, so adopting keys cannot break an older client.

| Situation | Result |
| --- | --- |
| No header | normal handling, nothing recorded |
| Key shorter than 8 chars | 400 `IDEMPOTENCY_KEY_INVALID` |
| First use of a key | handler runs; the response is stored as `COMPLETED` |
| Same key, same body | the stored response is replayed verbatim, with header `x-idempotency-replayed: true` |
| Same key, different body | 409 `IDEMPOTENCY_KEY_REUSED` |
| Same key while the first call is still running | 409 `IDEMPOTENCY_IN_PROGRESS` |
| Any 4xx/5xx outcome | the key is **released**, so the client can fix the request and retry |
| First attempt died mid-flight | reclaimed once older than `IN_PROGRESS_MAX_AGE_SEC` |

Three details that are easy to get wrong:

- **`responseBody` is text, not `JSONB`.** JSONB does not preserve key order, so a replayed response would come back as `result, status, message` and break the fixed `status, message, result` envelope contract.
- **A key belongs to a call that *succeeded*.** The response is captured on `finish`, and any 4xx/5xx deletes the row instead of storing it, so a client that sent a bad body once is not locked out of that key.
- **Keys are unique per `(userId, key)`**, not globally, and the unique index is what serialises concurrent retries — a check-then-insert would race.

`cleanup-expired` sweeps rows past `expiresAt` (`IDEMPOTENCY.RETENTION_HOURS`, default 24).

**Wallet and loyalty.** All wallet changes run in a Prisma transaction, a balance can never go negative, and a redemption is linked to an order. Behaviour is gated by `wallet.enabled`, `loyalty.enabled`, `referral.enabled` and `giftCard.enabled`.

### B7. Vendors

**Storefront.** `GET /vendors/getStore/:slug` is **public** — both `authenticate` and the role guards are skipped, so a guest can view a storefront without a token. Only an `APPROVED` shop is served; anything else is 403 `VENDOR_NOT_APPROVED`. The storefront uses its own serializer (`serializeVendorStorefront`), not `serializeVendor`: rating and product counts are shown, never bank details, KYC state or the vendor's user row.

| Item | Rule |
| --- | --- |
| Products | `vendor.storeProductLimit` (12), `ACTIVE` only, newest first |
| Announcements | only `ACTIVE` with `startsAt <= now <= endsAt`, pinned first |
| Vacation | `vacationData.isAcceptingOrders` = `!isOnVacation` |

**Approval.** With `vendor.autoApprove = true` a vendor becomes `APPROVED` the moment they register; with `false` (the default) an admin approves through `PATCH /vendors/approveVendor/:id`. Until then the vendor cannot create products (403 `VENDOR_NOT_APPROVED`).

**Vacation mode blocks order placement.** `updateVacation` sets the flag; `placeOrder` calls `assertVendorAcceptingOrders(vendorIds)` for the vendors whose flag is already true and throws 422 `VENDOR_ON_VACATION`. The check runs **before** the stock transaction, otherwise a refusal would leave a partial write behind. `until` must be in the future and is clamped to `vendor.vacationMaxDays` — clamped, not rejected.

**The vendor blocklist reuses `UserBlock`, not a new model.** The blocker is the vendor's `userId`, so the existing chat `assertNotBlocked` applies as is — there is no duplicate mechanism. `placeOrder` runs the same check: if any owner `userId` of the cart's vendors has a blocking row, the order is 403 `USER_BLOCKED`. The vendor-side message uses `ERROR.CHAT.USER_BLOCKED` ("You have blocked this user"), which does not match the direction — a `BLOCKED_BY_USER` key would be more accurate, but the existing key is reused.

**Vendor coupons.** `Coupon.vendorId` and the cart-side scoping (`cart.service.ts`) already existed — a vendor coupon only applies when the cart holds that vendor's product. The vendor-facing surface is separate from the admin one:

| Route | Rule |
| --- | --- |
| `GET /coupons/vendorCoupons` | the vendor's own list, scoped by `vendorId` |
| `POST /coupons/vendorCreateCoupon` | `vendorId` is **not** in the body — the service stamps it |
| `PATCH /coupons/vendorUpdateCoupon/:id` | ownership required |
| `DELETE /coupons/vendorDeleteCoupon/:id` | ownership required; soft delete |

`createVendorCoupon` delegates to the admin `createCoupon`, so code uniqueness and product/category existence checks live in one place. **An ownership failure is 403, a missing coupon is 404** — the client must be able to tell them apart: the coupon does not exist (`NOT_FOUND`) versus belongs to another store (`VENDOR_NOT_OWN_COUPON`, 403).

**Bulk order actions.** `POST /orders/vendorBulkStatusUpdate` moves several sub-orders of one vendor in one call — `ACCEPT` (→ `CONFIRMED`) or `REJECT` (→ `CANCELLED`).

- **Partial success, not all-or-nothing.** Any id in `subOrderIds` that is not this vendor's, or whose transition is not allowed, is skipped and the rest apply — a vendor triaging a queue must not lose the rows that would have worked. `skippedList` returns `{ subOrderId, reason }`, using the same message constants as the rest of the API.
- It is 422 `BULK_NO_SUB_ORDERS` only when **none** of the ids applies.
- Ownership is inside the `where` (`where: { id: { in: ids }, vendorId }`), so another vendor's sub-order is treated as "not found" and existence is not leaked.
- All writes run in one `prisma.$transaction` on the `tx` client. Rejecting runs `restoreStock(tx, orderId, subOrderId)`, and `refreshParentStatus` runs for every parent order — otherwise the parent order's status goes stale. Timeout is `20_000` / `maxWait: 8_000` (the same as `placeOrder`): 50 sub-orders × per-item stock restore would exceed the default 5 s.

### B8. Percentages

Every field named `percentage` is on a **0–100** scale, not a fraction. Clients put it straight into a template (`width: {percentage}%`), so `0.2` means `0.2%` and `20` means `20%`.

Two helpers in `src/utils/calculations.ts`:

| Helper | Used for | Behaviour |
| --- | --- | --- |
| `toPercent(part, total)` | share-of-total lists | 0–100, 1 decimal, `0` when `total` is `0` |
| `toPercentDistribution(parts)` | fixed-bucket columns | also 0–100, and the list sums to **exactly 100** |

`toPercentDistribution` gives the residual to the largest share. That matters because rounding each share separately drifts — three equal shares become `33.3 + 33.3 + 33.3 = 99.9` — and a distribution below 100 shows as a gap in a stacked bar.

**Call sites:** the `distributionList` of `reviews/getSummary/:productId` (five star buckets, a fixed column) uses `toPercentDistribution`. The other four (`analytics/getTopPages`, `getTrafficSources`, device breakdown, app versions) use `toPercent` because they are ranked lists, not fixed columns, and need not sum to exactly 100. `tests/percentage.test.ts` locks the scale.

### B9. Background jobs

**Retry.** Every job carries `attempts` and an exponential `backoff`, applied per job at enqueue time rather than as the queue's `defaultJobOptions` — `getQueue()` is synchronous everywhere and reading settings is not. Both numbers come from settings first, falling back to `QUEUE_POLICY` in `src/config/queue.config.ts`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `queue.maxAttempts` | `3` | total attempts, not retries after the first |
| `queue.backoffDelayMs` | `3000` | first backoff; exponential from there |
| `queue.maxReplays` | `3` | manual replays one dead row is allowed |

`queue.maxAttempts` is clamped to at least 1 — a zero would silently mean "run once, never retry".

**Dead letter queue.** When BullMQ spends the last attempt, the worker's `failed` hook writes a `FailedJob` row. The check is `attemptsMade >= job.opts.attempts`, not `attemptsMade > 0`, so the row appears only once the retry is actually spent — recording on the first transient failure would defeat the retry. The row is keyed `@@unique([queue, jobId])`: a job that fails, is replayed and fails again updates one row instead of accumulating one per attempt, and a resolved row reopens to `PENDING` when its job comes back.

| Situation | Result |
| --- | --- |
| Failure with attempts left | logged only; BullMQ retries it |
| Last attempt failed | `FailedJob` written, status `PENDING` |
| `retryFailedJob/:id` | re-queued under `replay-{jobId}-{n}`, `replayCount` incremented |
| Replay beyond `queue.maxReplays` | 409 `FAILED_JOB_REPLAY_LIMIT` |
| Queue or Redis down at replay time | 503 `FAILED_JOB_QUEUE_UNAVAILABLE`, row untouched |
| `resolveFailedJob/:id` | status `RESOLVED` with the acting admin, no replay |
| Replay or resolve on a non-`PENDING` row | 409 `FAILED_JOB_ALREADY_RESOLVED` |
| The write itself fails | logged; the worker keeps running |

Storing the row in Postgres instead of a Bull queue gives two properties: a failure survives a Redis flush, and an admin can query it over HTTP. **A replay gets its own queue id** (`replay-{jobId}-{n}`): reusing the original would collide with the retained failed job, and the original row has to stay as the record of what went wrong.

**Scheduled jobs.**

| Job | Schedule | Purpose |
| --- | --- | --- |
| `prune-failed-jobs` | nightly (`CRON.PRUNE_FAILED_JOBS`) | a `PENDING` row untouched for `DLQ.STALE_PENDING_DAYS` (30) becomes `ABANDONED`; anything `RESOLVED` or `ABANDONED` older than `DLQ.RESOLVED_RETENTION_DAYS` (30) is deleted |
| `lift-expired-bans` | `*/10 * * * *` | revokes expired `CustomerBan` rows and turns `isActive` back on |
| `refresh-customer-segments` | `0 6 * * *` | recomputes `NEW` / `REPEAT` / `VIP` / `WHOLESALE` / `BLOCKED` members |
| `purge-deleted-accounts` | cron | deletes accounts whose deletion recovery window has closed |
| `price-drop-scan` | cron | compares watched prices with targets and notifies |
| `cleanup-expired` | cron | sweeps expired idempotency keys |
| Analytics aggregation | `0 2 * * *` (`ANALYTICS.AGGREGATION_CRON`) | nightly rollup of Redis counters into Postgres |

An unreplayed failure that old has almost always been fixed by then, and keeping it forever only hides the live ones. `lift-expired-bans` and `refresh-customer-segments` sit on the same `cleanup` queue and delegate to a module service, so the cron and the admin endpoint run identical code. `lift-expired-bans` is frequent because skipping it would leave a customer permanently locked out; `refresh-customer-segments` is daily because its work is an aggregated order read and membership is not immediately useful.

### B10. Encrypted transport

- **Goal:** the client can send an encrypted body/query/sensitive headers (optional), and the API can send an encrypted response. **Toggle:** `ENCRYPTION_ENABLED=true|false` in `.env` — no code change to switch it on or off.
- **Algorithm:** AES-256-GCM (authenticated encryption, tamper-proof). `ENCRYPTION_KEY` must be exactly 64 hex characters when encryption is enabled.
- **Header:** the client sends `x-encrypted: 1` so the middleware knows to decrypt. When encryption is off the header is ignored and the body is treated as plain.
- **Skip list:** `/health`, `/docs`, `/docs.json`, `/webhooks` and `/track` are never encrypted, and binary file uploads are left alone.
- Document both modes — plain and encrypted — in the Swagger docs.
- **Key rotation:** changing `ENCRYPTION_KEY` can invalidate previously encrypted tokens/data — add a version field in future.
- An encrypted response bypasses the normal envelope: the client decrypts first and then finds the usual `status` / `message` / `result` envelope inside. When encryption is off, responses are the plain envelope.

```
Client (web / android / ios)
  ├─ payload JSON → encrypt(AES-256-GCM, sharedKey)
  ├─ header: x-encrypted: 1
  └─ POST /api/v1/orders/placeOrder   body: { iv, tag, data }

API encryption.middleware
  ├─ if ENCRYPTION.ENABLED && header present
  │    ├─ decrypt body → req.body
  │    └─ mark res.locals.shouldEncrypt = true
  ├─ the route handler runs normally on a plain req.body
  └─ on response: encrypt before sending

The client decrypts and parses the JSON.
```

`src/middlewares/encryption.middleware.ts`:

```ts
import crypto from 'crypto';
import { ENCRYPTION } from '../config/encryption.config';
import { ApiResponse } from '../utils/ApiResponse';

const KEY = Buffer.from(ENCRYPTION.KEY, 'hex');

const decryptPayload = (payload: { iv: string; tag: string; data: string }) => {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = crypto.createDecipheriv(ENCRYPTION.ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
};

const encryptPayload = (data: any) => {
  const iv = crypto.randomBytes(ENCRYPTION.IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION.ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
};

export const encryptionMiddleware = (req, res, next) => {
  if (!ENCRYPTION.ENABLED) return next();
  if (ENCRYPTION.SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

  const isEncrypted = req.headers[ENCRYPTION.HEADER_NAME] === '1';

  if (isEncrypted && req.body && req.body.data) {
    try {
      req.body = decryptPayload(req.body);
      res.locals.shouldEncrypt = true;
    } catch {
      return ApiResponse.error(res, {
        statusCode: 400,
        message: 'Invalid encrypted payload.',
        code: 'INVALID_ENCRYPTED_PAYLOAD',
      });
    }
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.locals.shouldEncrypt && body) {
      return originalJson({ encrypted: true, ...encryptPayload(body) });
    }
    return originalJson(body);
  };

  next();
};
```

### B11. Realtime, maintenance and tracking behaviour

- **Realtime.** Sockets live on the `/ws` namespace (events in [C1](#c1-static-config-files)). The JWT is verified at the socket handshake; messages are delivered by room, never broadcast to every client; chat messages are persisted to the DB.
- **Maintenance mode.** With `maintenance.enabled = true` every route answers `503 { status: false, message: "Maintenance", result: {} }` except `/health`, `/docs` and `/admin/*` for SUPER_ADMIN.
- **Tracking.** Every event carries `sessionId` and `deviceId`. Geo comes from `geoip-lite` and respects `X-Forwarded-For`; bots are filtered with `ua-parser-js` (`isBot` flag) and counted separately. Realtime counts come from Redis counters and rollups from a BullMQ nightly cron — never heavy synchronous DB writes per event. Raw events expire by TTL (`ANALYTICS.RETENTION_DAYS`). Exports stream (pagination or cursor).
- **Settings-driven behaviour.** Anything an admin can change at runtime (`loyalty.enabled`, `referral.enabled`, `giftCard.enabled`, `vendor.autoApprove`, `payment.*`, `shipping.*` …) is read at call time through `getSetting()` — see [Part C](#c3-systemsetting-defaults) for every key and default.

---

## Part C — Configuration and defaults

Two layers: **static** values live in code (`src/config/`), **dynamic** values live in the `SystemSetting` table (cached in Redis) so an admin can change them at runtime. Environment variables are documented in the README.

### C1. Static config files

`src/config/app.config.ts`

```ts
export const APP = {
  NAME: 'projectname',
  API_PREFIX: '/api/v1',
  DEFAULT_PORT: 5000,
  DEFAULT_LOCALE: 'en',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_DATE_FORMAT: 'DD-MM-YYYY',
  DEFAULT_TIME_FORMAT: 'hh:mm A',
  REQUEST_TIMEOUT_MS: 30_000,
  BODY_LIMIT: '1mb',
  JSON_LIMIT: '1mb',
  URLENCODED_LIMIT: '1mb',
};
```

`src/config/pagination.config.ts`

```ts
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  SORT_DEFAULT: '-createdAt',
  ALLOWED_SORTS: ['createdAt', 'updatedAt', 'price', 'name', 'rating', 'soldCount'],
};
```

`src/config/jwt.config.ts`

```ts
export const JWT = {
  ACCESS_EXPIRY: '15m',
  REFRESH_EXPIRY: '7d',
  ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  ISSUER: 'projectname-api',
  AUDIENCE: 'projectname-clients',
  REFRESH_COOKIE_NAME: 'refreshToken',
  REFRESH_COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  },
};
```

`src/config/password.config.ts`

```ts
export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 64,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  BCRYPT_ROUNDS: 12,
  RESET_TOKEN_EXPIRY_MIN: 30,
  CONTACT_CHANGE_COOLDOWN_MIN: 10,
};

export const WARRANTY = {
  MAX_MONTHS: 120,
  MAX_TAGS_PER_ORDER: 20,
  MAX_TAG_LENGTH: 40,
};

export const DELIVERY_INSTRUCTIONS = {
  MAX_LENGTH: 500,
};
```

`src/config/otp.config.ts`

```ts
export const OTP = {
  LENGTH: 6,
  EXPIRY_MIN: 10,
  MAX_ATTEMPTS: 3,
  RESEND_COOLDOWN_SEC: 60,
  MAX_RESENDS_PER_DAY: 10,
  BCRYPT_ROUNDS: 10,
  ATTEMPT_LOCK_MIN: 15,
  /**
   * Fixed code for local/testing, e.g. `111111`. Empty disables it and every
   * OTP is random. The env schema refuses this in production, because a known
   * code would let anyone log in as any account.
   */
  staticCode: ENV.OTP_STATIC_CODE,
};
```

`src/config/rateLimit.config.ts`

```ts
export const RATE_LIMIT = {
  GLOBAL: { WINDOW_MS: 15 * 60_000, MAX: 300 },
  AUTH_LOGIN: { WINDOW_MS: 15 * 60_000, MAX: 10 },
  AUTH_REGISTER: { WINDOW_MS: 60 * 60_000, MAX: 5 },
  FORGOT_PASSWORD: { WINDOW_MS: 60 * 60_000, MAX: 3 },
  OTP_SEND: { WINDOW_MS: 60_000, MAX: 1 },
  UPLOAD: { WINDOW_MS: 60_000, MAX: 20 },
  SEARCH: { WINDOW_MS: 60_000, MAX: 60 },
  TRACKING: { WINDOW_MS: 60_000, MAX: 600 },
  ANALYTICS: { WINDOW_MS: 60_000, MAX: 120 },
};
```

`src/config/upload.config.ts`

```ts
export const UPLOAD = {
  IMAGE: {
    MAX_SIZE_MB: 5,
    MAX_COUNT: 10,
    ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp'],
  },
  VIDEO: {
    MAX_SIZE_MB: 50,
    MAX_COUNT: 2,
    ALLOWED_MIME: ['video/mp4', 'video/webm'],
  },
  DOCUMENT: {
    MAX_SIZE_MB: 10,
    MAX_COUNT: 5,
    ALLOWED_MIME: ['application/pdf'],
  },
  CSV: {
    MAX_SIZE_MB: 20,
    MAX_COUNT: 1,
    ALLOWED_MIME: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  CLOUDINARY_FOLDER: 'projectname',
  TEMP_DIR: 'uploads/tmp',
};
```

`src/config/tracking.config.ts`

```ts
export const TRACKING = {
  SESSION_TIMEOUT_MIN: 30,
  HEARTBEAT_INTERVAL_SEC: 60,
  DEVICE_FINGERPRINT_ENABLED: true,
  GEO_LOOKUP_ENABLED: true,
  BOT_FILTER_ENABLED: true,
  EVENT_BATCH_SIZE: 50,
  EVENT_FLUSH_INTERVAL_MS: 5000,
  ALLOWED_EVENTS: [
    'app_open', 'app_install', 'app_update',
    'signup_start', 'signup_complete', 'login', 'logout',
    'product_view', 'category_view', 'search', 'filter_apply',
    'add_to_cart', 'remove_from_cart', 'add_to_wishlist',
    'checkout_start', 'address_add', 'payment_init',
    'payment_success', 'payment_fail', 'order_placed',
    'order_cancelled', 'order_returned', 'review_submit',
    'coupon_apply', 'coupon_fail', 'share', 'contact_click',
    'chat_open', 'chat_send', 'push_received', 'push_click',
  ],
};
```

`src/config/analytics.config.ts`

```ts
export const ANALYTICS = {
  REALTIME_WINDOW_MIN: 5,
  AGGREGATION_CRON: '0 2 * * *',
  RETENTION_DAYS: {
    RAW_EVENTS: 90,
    SESSIONS: 365,
    AGGREGATES: 1095,
  },
  CACHE_TTL_SEC: 300,
  COHORT_WEEKS: 12,
};
```

`src/config/shipping.config.ts`

```ts
export const SHIPPING = {
  DEFAULT_WEIGHT_UNIT: 'kg',
  DEFAULT_DIMENSION_UNIT: 'cm',
  DEFAULT_PARTNER: 'manual',
  TRACKING_REFRESH_MIN: 60,
};
```

`src/config/pdf.config.ts`

```ts
export const PDF = {
  PAGE_SIZE: 'A4',
  MARGIN: 40,
  FONT_SIZE: 10,
  HEADER_COLOR: '#111827',
  LOGO_PATH: 'assets/logo.png',
};
```

`src/config/socket.config.ts`

```ts
export const SOCKET = {
  NAMESPACE: '/ws',
  EVENTS: {
    CHAT_NEW: 'chat:new',
    CHAT_READ: 'chat:read',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    USER_ONLINE: 'user:online',
    ORDER_STATUS: 'order:status',
    ANALYTICS_LIVE: 'analytics:live',
    NOTIFICATION_NEW: 'notification:new',
  },
  HEARTBEAT_INTERVAL_MS: 25000,
};
```

`src/config/encryption.config.ts`

```ts
export const ENCRYPTION = {
  ENABLED: process.env.ENCRYPTION_ENABLED === 'true',
  ALGORITHM: 'aes-256-gcm',
  KEY: process.env.ENCRYPTION_KEY!,
  IV_LENGTH: 12,
  TAG_LENGTH: 16,
  HEADER_NAME: 'x-encrypted',
  SKIP_PATHS: ['/health', '/docs', '/docs.json', '/webhooks', '/track'],
};
```

**Other named limits** (defined in their own modules): `src/config/verification.config.ts` — `TTL_MIN` (15) and `TOKEN_BYTES` for the `verificationToken`; `src/config/queue.config.ts` — `QUEUE_POLICY`; `DLQ.STALE_PENDING_DAYS` (30) and `DLQ.RESOLVED_RETENTION_DAYS` (30); `CRON.PRUNE_FAILED_JOBS`; `IDEMPOTENCY.RETENTION_HOURS` (24) and `IDEMPOTENCY.IN_PROGRESS_MAX_AGE_SEC`; `TIMELINE_MAX_WINDOW` (200); `EXPORT_NOTIFICATION_LIMIT` (200).

### C2. Dynamic settings (`SystemSetting`)

- A setting is a `key` / `value` (JSON) / `category` / `isPublic` row. Reads go through `getSetting()`, cached in Redis for 5 minutes and invalidated when an admin updates the value.
- An admin changes a setting from the Settings page → `PATCH /settings/updateSetting` → DB update → Redis invalidated.
- **Public** settings (`isPublic: true`) are what clients fetch from `GET /settings/getPublicSettings` — site name, logo, currency, feature flags. Clients must not hardcode them.
- **Seeding never overwrites an admin's tuning.** Re-running the seed only refreshes a row's `category`; `value` and `isPublic` are left as they are, and every write is an `upsert`.
- `site.supportPhones` is always an array (`[]` or 3–4 numbers), never a string.
- `payment.token.*` settings control the token/advance flow: fixed or percent mode, min/max clamp, `applicableAbove`.
- `vendor.autoApprove`: `true` approves a vendor at registration, `false` leaves approval to an admin.

### C3. SystemSetting defaults

"Public" marks the keys returned by `getPublicSettings`; `—` means the seed does not specify it. Amounts are in INR.

#### General / Site

| Key | Default | Public |
| --- | --- | --- |
| `site.name` | `"ProjectName"` | yes |
| `site.logo` | `""` | yes |
| `site.supportEmail` | `"support@projectname.com"` | yes |
| `site.supportPhones` | `[]` (JSON array — 3 to 4 numbers) | yes |
| `site.favicon` | `""` | yes |
| `site.tagline` | `""` | yes |
| `site.addressLine` | `""` | yes |
| `site.socialLinks` | `{}` (object: `{facebook,instagram,twitter,youtube}`) | yes |
| `site.maintenanceImage` | `""` | yes |

#### Locale / Timezone / Currency

| Key | Default | Public |
| --- | --- | --- |
| `currency.code` | `"INR"` | yes |
| `currency.symbol` | `"₹"` | yes |
| `currency.decimals` | `2` | yes |
| `locale.default` | `"en"` | yes |
| `locale.supported` | `["en", "hi"]` (JSON array) | yes |
| `timezone.default` | `"Asia/Kolkata"` | yes |
| `date.format` | `"DD-MM-YYYY"` | yes |
| `time.format` | `"hh:mm A"` | yes |

#### Business / Commission

| Key | Default | Public |
| --- | --- | --- |
| `commission.default` | `10` (percent) | no |
| `commission.minPercent` | `0` | no |
| `commission.maxPercent` | `50` | no |
| `tax.defaultGstPercent` | `18` | yes |
| `tax.inclusive` | `false` | yes |

#### Order

| Key | Default | Public |
| --- | --- | --- |
| `order.minAmount` | `100` (INR) | yes |
| `order.maxItems` | `50` | yes |
| `order.cancelWindowMin` | `30` | yes |
| `order.autoCancelUnpaidMin` | `1440` (24h) | no |
| `order.allowGuestCheckout` | `false` | yes |
| `order.requirePhoneVerify` | `true` | yes |
| `order.maxPerCustomerPerDay` | `20` | no |
| `order.showVendorSplit` | `true` | yes |

#### Payment — COD / UPI / Bank

| Key | Default | Public |
| --- | --- | --- |
| `payment.cod.enabled` | `true` | yes |
| `payment.upi.enabled` | `true` | yes |
| `payment.bank.enabled` | `true` | yes |
| `payment.upi.id` | `"projectname@upi"` | yes |
| `payment.bank.holderName` | `"ProjectName Pvt Ltd"` | yes |
| `payment.bank.accountNo` | `"000000000000"` | yes |
| `payment.bank.ifsc` | `"HDFC0000000"` | yes |
| `payment.cod.maxAmount` | `20000` | yes |
| `payment.cod.enabledAbove` | `0` | yes |
| `payment.cod.extraCharge` | `0` (INR) | yes |
| `payment.razorpay.enabled` | `false` | no |
| `payment.razorpay.keyId` | `""` | no |
| `payment.razorpay.webhookSecret` | `""` | no |

#### Payment — Token / Advance

| Key | Default | Public |
| --- | --- | --- |
| `payment.token.enabled` | `false` | yes |
| `payment.token.mode` | `"percent"` (`"percent"` \| `"fixed"`) | yes |
| `payment.token.percent` | `20` | yes |
| `payment.token.fixedAmount` | `100` (INR) | yes |
| `payment.token.minAmount` | `50` (INR) | yes |
| `payment.token.maxAmount` | `5000` (INR) | yes |
| `payment.token.applicableAbove` | `2000` | yes |
| `payment.token.allowedMethods` | `["UPI", "CARD", "NETBANKING"]` | yes |
| `payment.token.refundable` | `true` | yes |
| `payment.token.refundPercent` | `100` | yes |
| `payment.token.cancelWindowMin` | `60` | yes |
| `payment.token.balanceDueDays` | `7` | yes |
| `payment.token.balanceReminderHours` | `[24, 48, 72]` | no |
| `payment.token.forfeitOnNoPay` | `true` | no |
| `payment.token.autoCancelAfterDue` | `true` | no |

#### Shipping / Delivery

| Key | Default | Public |
| --- | --- | --- |
| `shipping.enabled` | `true` | yes |
| `shipping.defaultCharge` | `49` (INR) | yes |
| `shipping.freeAbove` | `999` (INR) | yes |
| `shipping.estimatedDays` | `5` | yes |
| `shipping.perKgCharge` | `0` (INR, 0 = off) | yes |
| `shipping.maxDistanceKm` | `0` (0 = unlimited) | yes |
| `shipping.serviceablePincodes` | `[]` | yes |

#### Return / Refund

| Key | Default | Public |
| --- | --- | --- |
| `return.enabled` | `true` | yes |
| `return.windowDays` | `7` | yes |
| `return.reasonRequired` | `true` | yes |
| `return.imagesRequired` | `true` | yes |
| `return.maxQtyPerOrder` | `0` | no |
| `review.editWindowDays` | `7` | yes |
| `refund.processingDays` | `5` | yes |
| `refund.mode` | `"original"` | yes |

#### Wallet / Loyalty

| Key | Default | Public |
| --- | --- | --- |
| `wallet.enabled` | `false` | yes |
| `wallet.maxBalance` | `50000` (INR) | yes |
| `wallet.minRedeem` | `100` (INR) | yes |
| `wallet.expiryDays` | `365` | yes |
| `loyalty.enabled` | `false` | yes |
| `loyalty.pointsPerRupee` | `1` | yes |
| `loyalty.pointValue` | `0.01` | yes |
| `loyalty.minRedeemPoints` | `100` | yes |

#### Coupon

| Key | Default | Public |
| --- | --- | --- |
| `coupon.maxPerOrder` | `1` | yes |
| `coupon.stackable` | `false` | yes |
| `coupon.minOrderAmount` | `0` (INR) | yes |
| `coupon.maxDiscount` | `0` (0 = unlimited) | yes |

#### Features

| Key | Default | Public |
| --- | --- | --- |
| `feature.reviews` | `true` | yes |
| `feature.wishlist` | `true` | yes |
| `feature.coupons` | `true` | yes |
| `feature.chat` | `false` | yes |
| `feature.multiVendor` | `true` | yes |
| `feature.guestCheckout` | `false` | yes |
| `feature.productCompare` | `false` | yes |
| `feature.recentlyViewed` | `true` | yes |
| `feature.liveTracking` | `false` | yes |
| `feature.wallet` | `false` | yes |
| `feature.loyalty` | `false` | yes |
| `feature.referral` | `false` | yes |
| `feature.giftCards` | `false` | yes |
| `feature.chatSupport` | `false` | yes |
| `feature.ticketSupport` | `true` | yes |
| `feature.socialLogin` | `true` | yes |
| `feature.twoFactor` | `false` | yes |
| `feature.analytics` | `true` | yes |
| `feature.tracking` | `true` | yes |

#### Catalog

| Key | Default | Public |
| --- | --- | --- |
| `catalog.productsPerPage` | `20` | yes |
| `catalog.showOutOfStock` | `true` | yes |
| `catalog.allowBackorder` | `false` | yes |
| `catalog.defaultSort` | `"-createdAt"` | yes |
| `catalog.maxImagesPerProduct` | `10` | no |

#### Cart

| Key | Default | Public |
| --- | --- | --- |
| `cart.maxItems` | `50` | yes |
| `cart.holdMinutes` | `30` | no |
| `cart.persistAcrossDevices` | `true` | yes |
| `cart.giftWrapCharge` | `49` (INR, once per wrapped line) | — |
| `cart.giftWrapNoteMaxLength` | not specified | — |

#### Vendor / Payout

| Key | Default | Public |
| --- | --- | --- |
| `vendor.autoApprove` | `false` | no |
| `vendor.maxProducts` | `500` | no |
| `vendor.minPayoutAmount` | `500` (INR) | no |
| `vendor.payoutCycleDays` | `7` | no |
| `vendor.payoutHoldDays` | `3` | no |
| `vendor.commissionOverrideAllowed` | `true` | no |
| `vendor.vacationMaxDays` | `90` | no |
| `vendor.storeProductLimit` | `12` | yes |

#### Notification

| Key | Default | Public |
| --- | --- | --- |
| `notification.email.enabled` | `true` | no |
| `notification.sms.enabled` | `false` | no |
| `notification.push.enabled` | `true` | no |
| `notification.whatsapp.enabled` | `false` | no |
| `notification.orderEvents` | `["CONFIRMED","SHIPPED","DELIVERED","CANCELLED"]` | no |
| `notification.tokenBalanceReminder` | `true` | no |

#### Security

| Key | Default | Public |
| --- | --- | --- |
| `security.otpLoginEnabled` | `false` | no |
| `security.twoFactorEnabled` | `false` | no |
| `security.maxLoginAttempts` | `5` | no |
| `security.lockoutMinutes` | `15` | no |
| `security.passwordMinLength` | `8` | no |
| `security.passwordHistoryCount` | `3` | no |
| `security.requireEmailVerify` | `false` | no |
| `security.requirePhoneVerify` | `true` | no |
| `security.sessionDays` | `7` | no |
| `security.loginNotifyEnabled` | `true` | — |
| `security.banMaxDays` | `365` | — |
| `security.passwordExpiryDays` | `0` (passwords never expire) | — |
| `security.maxActiveSessions` | `0` (unlimited) | — |
| `security.accountPurgeDays` | `30` | — |
| `security.loginAlerts` | `true` | — |
| `security.newDeviceAlerts` | not specified | — |

#### Customer

| Key | Default | Public |
| --- | --- | --- |
| `customer.segment.repeatOrders` | `2` | — |
| `customer.segment.wholesaleOrders` | `10` | — |
| `customer.segment.vipSpend` | `10000` | — |
| `customer.segment.batchSize` | `500` | — |

#### System / Maintenance

| Key | Default | Public |
| --- | --- | --- |
| `maintenance.enabled` | `false` | no |
| `maintenance.message` | `"We'll be back soon."` | yes |
| `maintenance.allowedIps` | `[]` | no |
| `system.encryptionEnabled` | `false` | no |
| `system.apiRateLimitPerMin` | `100` | no |

#### App / Android / iOS

| Key | Default | Public |
| --- | --- | --- |
| `app.minAndroidVersion` | `"1.0.0"` | yes |
| `app.forceUpdateAndroid` | `false` | yes |
| `app.latestAndroidVersion` | `"1.0.0"` | yes |
| `app.minIosVersion` | `"1.0.0"` | yes |
| `app.forceUpdateIos` | `false` | yes |
| `app.latestIosVersion` | `"1.0.0"` | yes |
| `app.updateMessage` | `""` | yes |

#### Tracking & Analytics

| Key | Default | Public |
| --- | --- | --- |
| `tracking.enabled` | `true` | no |
| `tracking.sessionTimeoutMin` | `30` | no |
| `tracking.geoLookupEnabled` | `true` | no |
| `tracking.botFilterEnabled` | `true` | no |
| `tracking.rawRetentionDays` | `90` | no |
| `analytics.realtimeWindowMin` | `5` | no |
| `analytics.aggregationCron` | `"0 2 * * *"` | no |
| `analytics.exportMaxRows` | `50000` | no |

#### Referral / Gift Cards

| Key | Default | Public |
| --- | --- | --- |
| `referral.enabled` | `false` | yes |
| `referral.referrerReward` | `100` (INR) | no |
| `referral.refereeReward` | `50` (INR) | no |
| `referral.expiryDays` | `90` | no |
| `giftCard.enabled` | `false` | yes |
| `giftCard.minAmount` | `100` | yes |
| `giftCard.maxAmount` | `50000` | yes |
| `giftCard.expiryDays` | `365` | yes |

#### Support / Chat

| Key | Default | Public |
| --- | --- | --- |
| `support.ticket.enabled` | `true` | yes |
| `support.chat.enabled` | `false` | yes |
| `support.chatAutoReply` | `true` | no |
| `support.workingHours` | `{start: "10:00", end: "19:00"}` | yes |

#### Queue

| Key | Default | Public |
| --- | --- | --- |
| `queue.maxAttempts` | `3` (clamped to at least 1) | — |
| `queue.backoffDelayMs` | `3000` | — |
| `queue.maxReplays` | `3` | — |

---

## Part D — Edge cases and error behaviour

What the API returns in the cases a client will hit. Every error uses the standard error envelope (`status: false`, the code inside `message`, `result: {}`) — see `AGENTS.md`. Codes raised by a specific rule (idempotency, bans, segments, failed jobs, vacation, …) are listed in Part B next to the rule. Prisma errors are already mapped in `src/middlewares/error.ts` — services do not re-map them.

### Auth

| Case | Behaviour | Response |
| --- | --- | --- |
| Email already registered | reject | 409 `EMAIL_EXISTS` |
| Wrong password | generic error — never differentiated from "email not found" | 401 `INVALID_CREDENTIALS` |
| Access token expired | client refreshes | 401 `TOKEN_EXPIRED` |
| Refresh token expired or revoked | force logout | 401 `SESSION_EXPIRED` |
| Role mismatch | reject | 403 `FORBIDDEN` |
| Suspended user signs in | reject | 403 `ACCOUNT_SUSPENDED` |
| Unverified account signs in | reject | 403 `ACCOUNT_UNVERIFIED` |
| Banned customer signs in | reject, days remaining in the message | 403 `ACCOUNT_BANNED` |
| Password older than `security.passwordExpiryDays` | block password login | 403 `PASSWORD_EXPIRED` |
| New password matches a retained hash | reject | 422 `PASSWORD_REUSED` |
| Register `type` invalid | Zod reject | 400 `INVALID_REGISTER_TYPE` |
| Vendor register without `shopName` | Zod reject | 400 `VENDOR_DETAILS_REQUIRED` |
| Vendor register, slug taken | auto-append `-2`, `-3` | 201 with the new slug |
| Vendor register with `autoApprove = false` | User + VendorProfile created, status `PENDING` | 201, `rolesList: ["VENDOR"]` |
| `sendOtp` `type` invalid | Zod reject | 400 `INVALID_OTP_TYPE` |
| OTP wrong, expired or already used | reject | 401 `OTP_INVALID` |
| OTP max attempts | block | 429 `OTP_MAX_ATTEMPTS` |
| OTP resend cooldown | block | 429 `OTP_RESEND_COOLDOWN` |
| `verificationToken` for a different contact | reject, token not spent | 400 `VERIFICATION_IDENTIFIER_MISMATCH` |
| `verificationToken` reused or expired | reject | 401 `VERIFICATION_INVALID` |
| Social provider token invalid | reject | 401 `SOCIAL_PROVIDER_INVALID` |
| 2FA enabled, no code | reject | 401 `TWO_FA_REQUIRED` |
| 2FA wrong code | reject | 401 `TWO_FA_INVALID` |
| `checkAvailability` with both fields empty | Zod reject | 400 `VALIDATION_ERROR` |
| Restore after the deletion window | reject | 410 `ACCOUNT_PURGE_WINDOW` |

### Product

| Case | Behaviour | Response |
| --- | --- | --- |
| Vendor A edits vendor B's product | block | 403 `FORBIDDEN` |
| Vendor not approved adds a product | reject | 403 `VENDOR_NOT_APPROVED` |
| Duplicate slug | auto-append `-2`, `-3` | 201 with the new slug |
| Price ≤ 0 | Zod reject | 400 `VALIDATION_ERROR` |
| Negative stock | Zod reject | 400 |
| Delete with active orders | soft delete | 200 `PRODUCT_ARCHIVED` |
| Image count over the limit | reject | 400 `TOO_MANY_FILES` |
| MIME type not allowed | reject | 415 `UNSUPPORTED_MEDIA_TYPE` |
| File larger than the limit | multer rejects | 413 `PAYLOAD_TOO_LARGE` |
| Bulk CSV with a bad row | skip the row, log the error, return a summary | 200 with `successCount`, `failCount` |
| Brand delete while it has products | soft delete or reject | 409 `BRAND_IN_USE` |

### Cart and order

| Case | Behaviour | Response |
| --- | --- | --- |
| Add an out-of-stock item | block | 422 `OUT_OF_STOCK` |
| Items from two vendors | split into two SubOrders | 201 |
| Stock changed at checkout | re-validate | 409 `STOCK_CHANGED` |
| Coupon expired | reject | 422 `COUPON_EXPIRED` |
| Coupon minimum not met | reject | 422 `COUPON_MIN_NOT_MET` |
| Order below the minimum amount | reject | 422 `ORDER_MIN_AMOUNT` |
| Cancel after the window | reject | 422 `CANCEL_WINDOW_PASSED` |
| Invalid status transition | reject | 422 `INVALID_STATUS_TRANSITION` |
| Vendor updates another vendor's sub-order | block | 403 |
| Empty cart | reject | 400 `CART_EMPTY` |
| Return window passed | reject | 422 `RETURN_WINDOW_PASSED` |
| Return of a non-returnable item | reject | 422 `NON_RETURNABLE` |
| Reorder containing a deleted product | skip the deleted ones, return partial | 201 with `skippedList` |

### Payment and payout

| Case | Behaviour | Response |
| --- | --- | --- |
| Token already paid | block | 409 `ALREADY_PAID` |
| Balance paid before the token | block | 422 `TOKEN_PENDING` |
| Payout below the minimum | block | 422 `PAYOUT_MIN_AMOUNT` |
| Payout with a pending order | block | 422 `PENDING_ORDERS` |
| Refund exceeds what was paid | reject | 422 `REFUND_EXCEEDS_PAID` |
| Same idempotency key, different body | reject | 409 `IDEMPOTENCY_KEY_REUSED` |
| Razorpay signature fails | reject | 400 `INVALID_SIGNATURE` |

### Review and Q&A

| Case | Behaviour | Response |
| --- | --- | --- |
| Review without a purchase | reject | 403 `PURCHASE_REQUIRED` |
| Duplicate review | reject | 409 `ALREADY_REVIEWED` |
| Vendor reviews their own product | block | 403 `FORBIDDEN` |
| Review edited past the window | reject | 422 `EDIT_WINDOW_PASSED` |
| Q&A on a deleted product | not found | 404 `NOT_FOUND` |

### Chat and ticket

| Case | Behaviour | Response |
| --- | --- | --- |
| Chat with a blocked user | block | 403 `USER_BLOCKED` |
| Ticket reply after it was closed | block | 422 `TICKET_CLOSED` |
| File in chat over the limit | reject | 413 |
| Socket disconnects mid-send | queue and retry | logged |

### Tracking and analytics

| Case | Behaviour |
| --- | --- |
| Duplicate event within 5 s | de-duplicated through a Redis key |
| Missing `deviceId` | generated server-side, warning logged |
| Bot user-agent | not stored, counted separately |
| Geo lookup fails | store `{}`, log a warning |
| Huge payload | reject with 413 |
| Track call before a session exists | session is auto-created |
| Crash report without a device | stored with `deviceId: ""` |
| Analytics export over the maximum rows | paginate or stream the CSV |

### Device and session

| Case | Behaviour |
| --- | --- |
| Duplicate `deviceId` | update `lastSeenAt` |
| Blocked device makes a request | 403 `DEVICE_BLOCKED` (checked on every request) |
| Session timeout | automatically `isActive = false` |
| Trust toggle | update `isTrusted` |
| Revoke an active session | invalidate its refresh token |

### Upload

| Case | Behaviour |
| --- | --- |
| No file | 400 `FILE_REQUIRED` |
| Count over the maximum | 400 `TOO_MANY_FILES` |
| Wrong MIME type | 415 `UNSUPPORTED_MEDIA_TYPE` |
| Size exceeded | 413 `PAYLOAD_TOO_LARGE` |
| Cloudinary down | 503 and a retry queue |
| Cloudinary not configured | upload routes answer 503; `GET /uploads/getSignedUrl` reports `enabled: false` |
| Special characters in the filename | sanitised |

### Rate limit

| Case | Behaviour |
| --- | --- |
| Limit hit | 429 with a `Retry-After` header |
| Redis down | fall back to an in-memory store and log it |
| Proxy IP | `trust proxy` + `X-Forwarded-For` |
| Tracking burst | higher limit (`TRACKING` config) |

### Maintenance mode

| Case | Behaviour |
| --- | --- |
| `maintenance.enabled = true` | 503 except `/health`, `/docs`, `/admin/*` for SUPER_ADMIN |
| Response | `503 { status: false, message: "Maintenance", result: {} }` |

### Encryption

| Case | Behaviour |
| --- | --- |
| `x-encrypted: 1` but a plain body | 400 `INVALID_ENCRYPTED_PAYLOAD` |
| Wrong key | 400 `DECRYPT_FAILED` |
| Encryption off, header present | ignore the header, treat the body as plain |
| Skip paths | `/health`, `/docs`, `/docs.json`, `/webhooks`, `/track` |
| File upload | skipped (binary) |

### Database and Prisma

| Case | Behaviour |
| --- | --- |
| Migration fails | the build fails |
| Connection pool exhausted | tune the pool and log |
| `P2002` unique violation | 409 `DUPLICATE` |
| `P2025` record not found | 404 `NOT_FOUND` |
| Transaction fails | rollback, log, 500 `INTERNAL_ERROR` |

### CORS

| Case | Behaviour |
| --- | --- |
| Origin not whitelisted | block |
| Preflight | 204 with the allowed methods |
| Cross-site cookies | `credentials: true` + `SameSite=None; Secure` in production |
| Socket origin | separate `SOCKET_CORS_ORIGINS` |

### Validation

| Case | Behaviour |
| --- | --- |
| Extra unknown fields | `.strict()` rejects them |
| Empty string vs `undefined` | empty is invalid for a required field |
| Number sent as a string | `z.coerce.number()` |
| Boolean sent as `"true"` / `"false"` | `z.coerce.boolean()` |

### i18n, currency and geo

| Case | Behaviour |
| --- | --- |
| Unsupported locale | fall back to the default `en` |
| Missing translation key | return the key itself and log it |
| Unknown pincode | `serviceable: false` |
| Currency mismatch | convert in the display layer, never stored |

---

## Part E — Endpoints

Every route is mounted under `/api/v1`. The tables below are derived from the OpenAPI spec and enriched with auth and role information; when they disagree with `GET /api/v1/docs.json`, the spec is right — it is generated from the live Express router, whereas a hand-written list drifts. Route prefixes map to code modules as shown in the README.

- **Auth:** `Public` = no token; `Required` = valid access token; `Refresh cookie` = the HttpOnly refresh cookie; `Signature` = webhook signature check.
- **Role:** `ADMIN` is shorthand for the staff roles (`SUB_ADMIN` / `SUPER_ADMIN`); `SUPER_ADMIN` marks routes reserved for the super admin; `Any` = any signed-in (or anonymous, where Auth is `Public`) caller; `—` = not specified.
- **Path parameters** are written `{id}`. List endpoints accept `?page=1&limit=20&sort=-createdAt&search=`.
- **Documentation routes:** Swagger UI at `GET /docs/`, with its assets (`/docs/swagger-ui-bundle.js`, `/docs/swagger-ui-standalone-preset.js`, `/docs/swagger-ui.css`), and the OpenAPI JSON at `GET /docs.json` and `GET /docs/docs.json`.

#### `/activityLogs`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/activityLogs/getAll` | Required | ADMIN | List activity logs |

#### `/admin`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/admin/deleteSubAdmin/{id}` | Required | SUPER_ADMIN | Delete |
| DELETE | `/admin/deleteFailedJob/{id}` | Required | SUPER_ADMIN | Drop the row |
| GET | `/admin/getActivityLogs` | Required | ADMIN | Activity |
| GET | `/admin/getAllSubAdmins` | Required | SUPER_ADMIN | List sub-admins |
| GET | `/admin/getAuditLogs` | Required | ADMIN | Audit logs |
| GET | `/admin/getCronJobs` | Required | SUPER_ADMIN | Job list |
| GET | `/admin/getDashboardStats` | Required | ADMIN | Dashboard metrics |
| GET | `/admin/getFailedJobs` | Required | SUPER_ADMIN | Dead letter queue |
| GET | `/admin/getPermissions` | Required | ADMIN | All permissions |
| GET | `/admin/getSystemHealth` | Required | SUPER_ADMIN | DB/Redis/Queue |
| PATCH | `/admin/resolveFailedJob/{id}` | Required | SUPER_ADMIN | Close without replay |
| PATCH | `/admin/toggleSubAdminStatus/{id}` | Required | SUPER_ADMIN | Active/Suspend |
| PATCH | `/admin/updatePermissions/{id}` | Required | SUPER_ADMIN | Set perms |
| PATCH | `/admin/updateSubAdmin/{id}` | Required | SUPER_ADMIN | Update |
| POST | `/admin/clearCache` | Required | SUPER_ADMIN | Flush Redis |
| POST | `/admin/createSubAdmin` | Required | SUPER_ADMIN | Create sub-admin |
| POST | `/admin/retryFailedJob/{id}` | Required | SUPER_ADMIN | Replay a failed job |
| POST | `/admin/triggerJob` | Required | SUPER_ADMIN | Manual run |

#### `/analytics`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/analytics/export` | Required | ADMIN | CSV export |
| GET | `/analytics/getAbandonedCarts` | Required | ADMIN | Abandoned |
| GET | `/analytics/getAppVersions` | Required | ADMIN | Version dist |
| GET | `/analytics/getConversions` | Required | ADMIN | Conversions |
| GET | `/analytics/getCrashes` | Required | ADMIN | Crash reports |
| GET | `/analytics/getCustomerCohorts` | Required | ADMIN | Retention |
| GET | `/analytics/getDeviceBreakdown` | Required | ADMIN | Device/OS |
| GET | `/analytics/getFunnel` | Required | ADMIN | Funnel |
| GET | `/analytics/getGeoBreakdown` | Required | ADMIN | Geo |
| GET | `/analytics/getOverview` | Required | ADMIN | KPIs |
| GET | `/analytics/getPageViews` | Required | ADMIN | PV |
| GET | `/analytics/getProductPerformance` | Required | VENDOR / ADMIN | Product KPIs |
| GET | `/analytics/getRealtime` | Required | ADMIN | Live users |
| GET | `/analytics/getRevenueReport` | Required | ADMIN | Revenue |
| GET | `/analytics/getSearchTerms` | Required | ADMIN | Top searches |
| GET | `/analytics/getSessionDetail/{id}` | Required | ADMIN | Journey |
| GET | `/analytics/getSessions` | Required | ADMIN | Sessions |
| GET | `/analytics/getTopPages` | Required | ADMIN | Top pages |
| GET | `/analytics/getTrafficSources` | Required | ADMIN | Traffic |
| GET | `/analytics/getUniqueVisitors` | Required | ADMIN | UV |
| GET | `/analytics/getVendorPerformance` | Required | ADMIN | Vendor KPIs |
| GET | `/analytics/getVisitors` | Required | ADMIN | Visitor stats |
| GET | `/analytics/getZeroResultSearches` | Required | ADMIN | Missed searches |
| GET | `/analytics/funnels` | Required | ADMIN | List funnels |
| POST | `/analytics/funnels` | Required | ADMIN | Create funnel |
| PATCH | `/analytics/funnels/{id}` | Required | ADMIN | Update funnel |

#### `/apiKeys`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/apiKeys/delete/{id}` | Required | ADMIN | Delete |
| GET | `/apiKeys/getAll` | Required | ADMIN | List |
| GET | `/apiKeys/getUsage/{id}` | Required | ADMIN | Usage |
| PATCH | `/apiKeys/revoke/{id}` | Required | ADMIN | Revoke |
| POST | `/apiKeys/create` | Required | ADMIN | Create key |

#### `/attributes`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/attributes/deleteAttribute/{id}` | Required | ADMIN | Delete |
| GET | `/attributes/getAll` | Public | Public | List attributes |
| GET | `/attributes/getById/{id}` | Public | Public | Single attribute |
| PATCH | `/attributes/updateAttribute/{id}` | Required | ADMIN | Update |
| POST | `/attributes/createAttribute` | Required | ADMIN | Create attribute |

#### `/auditLogs`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/auditLogs/purge` | Required | SUPER_ADMIN | Purge old |
| GET | `/auditLogs/export` | Required | ADMIN | CSV |
| GET | `/auditLogs/getAll` | Required | ADMIN | List |
| GET | `/auditLogs/getByActor/{userId}` | Required | ADMIN | Actor logs |
| GET | `/auditLogs/getById/{id}` | Required | ADMIN | Detail |

#### `/auth`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/auth/sessions/{id}` | Required | Any | Revoke session |
| GET | `/auth/getMe` | Required | Any | Current user |
| GET | `/auth/getMyConsents` | Required | Any | List the terms / privacy / marketing consents the user has accepted |
| GET | `/auth/sessions` | Required | Any | Active sessions |
| POST | `/auth/acceptConsent` | Required | Any | Record acceptance of a consent (type, version, IP, user-agent) |
| POST | `/auth/changeEmail` | Required | Any | Swap the sign-in email |
| POST | `/auth/changeEmail/sendOtp` | Required | Any | Step 1 of a contact change — send a code to the contact being claimed (`type: EMAIL_CHANGE \| PHONE_CHANGE`) |
| POST | `/auth/changeEmail/verifyOtp` | Required | Any | Step 2 — code → `verificationToken` |
| POST | `/auth/changePassword` | Required | Any | Change own password |
| POST | `/auth/changePhone` | Required | Any | Swap the phone number |
| POST | `/auth/checkAvailability` | Public | Public | Check email/phone |
| POST | `/auth/disable2FA` | Required | Any | Disable 2FA |
| POST | `/auth/enable2FA` | Required | Any | Enable 2FA |
| POST | `/auth/forgotPassword` | Public | Public | Trigger reset OTP flow |
| POST | `/auth/linkSocial` | Required | Any | Link social account |
| POST | `/auth/login` | Public | Public | Password login (any role) |
| POST | `/auth/login/verifyOtp` | Public | Public | OTP login step 2 — verify the code and sign in |
| POST | `/auth/logout` | Required | Any | Logout + revoke refresh |
| POST | `/auth/logoutAllDevices` | Required | Any | Revoke all sessions |
| POST | `/auth/refreshToken` | Refresh cookie | Any | Refresh the access token |
| POST | `/auth/register` | Public | Public | Registration step 3 — spend the token (`type: CUSTOMER` or `type: VENDOR`) |
| POST | `/auth/register/sendOtp` | Public | Public | Registration step 1 — request a code |
| POST | `/auth/register/verifyOtp` | Public | Public | Registration step 2 — code → `verificationToken` |
| POST | `/auth/resetPassword` | Public | Public | Reset with OTP |
| POST | `/auth/restoreAccount` | Public | Public | Restore inside the deletion recovery window |
| POST | `/auth/sendOtp` | Public | Public | Send an OTP — `type: REGISTER \| FORGOT_PASSWORD \| LOGIN \| PHONE_VERIFY \| EMAIL_VERIFY \| TWO_FA` |
| POST | `/auth/socialLogin` | Public | Public | Google/Apple/Facebook |
| POST | `/auth/unlinkSocial` | Required | Any | Unlink social |
| POST | `/auth/verify2FA` | Public | Public | 2FA challenge |
| POST | `/auth/verifyEmail` | Required | Any | Verify email |
| POST | `/auth/verifyOtp` | Public | Public | Verify OTP |
| POST | `/auth/verifyPhone` | Required | Any | Verify phone |

#### `/banners`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/banners/delete/{id}` | Required | ADMIN | Delete |
| GET | `/banners/getAll` | Public | Public | Active banners |
| PATCH | `/banners/update/{id}` | Required | ADMIN | Update |
| POST | `/banners/create` | Required | ADMIN | Create banner |

#### `/blogs`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/blogs/delete/{id}` | Required | ADMIN | Delete |
| GET | `/blogs/getAll` | Public | Public | List blogs |
| GET | `/blogs/getBySlug/{slug}` | Public | Public | Detail |
| PATCH | `/blogs/update/{id}` | Required | ADMIN | Update |
| POST | `/blogs/create` | Required | ADMIN | Create blog |

#### `/brands`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/brands/deleteBrand/{id}` | Required | ADMIN | Delete |
| GET | `/brands/getAll` | Public | Public | List brands |
| GET | `/brands/getById/{id}` | Public | Public | Single brand |
| GET | `/brands/getBySlug/{slug}` | Public | Public | Brand by slug |
| PATCH | `/brands/updateBrand/{id}` | Required | ADMIN | Update |
| POST | `/brands/createBrand` | Required | ADMIN | Create brand |

#### `/bulk`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/bulk/getJobHistory` | Required | Any | History |
| GET | `/bulk/getJobStatus/{jobId}` | Required | Any | Job status |
| POST | `/bulk/importOrders` | Required | ADMIN | Bulk orders |
| POST | `/bulk/importProducts` | Required | VENDOR | CSV import |
| POST | `/bulk/importUsers` | Required | ADMIN | Bulk users |

#### `/cannedResponses`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/cannedResponses/delete/{id}` | Required | ADMIN | Delete canned response |
| GET | `/cannedResponses/getAll` | Required | ADMIN | List canned responses |
| PATCH | `/cannedResponses/update/{id}` | Required | ADMIN | Update canned response |
| POST | `/cannedResponses/create` | Required | ADMIN | Create canned response |

#### `/cart`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/cart/clearCart` | Required | CUSTOMER | Clear cart |
| DELETE | `/cart/removeCoupon` | Required | CUSTOMER | Remove coupon |
| DELETE | `/cart/removeItem/{cartItemId}` | Required | CUSTOMER | Remove item |
| DELETE | `/cart/savedForLater` | Required | CUSTOMER | Clear saved lines |
| DELETE | `/cart/savedForLater/{id}` | Required | CUSTOMER | Drop a saved line |
| GET | `/cart/getCart` | Required | CUSTOMER | View cart |
| GET | `/cart/getSavedForLater` | Required | CUSTOMER | List saved-for-later |
| PATCH | `/cart/updateItem` | Required | CUSTOMER | Update qty |
| PATCH | `/cart/updateItemOptions/{cartItemId}` | Required | CUSTOMER | Gift wrap + per-item delivery note |
| POST | `/cart/addItem` | Required | CUSTOMER | Add item |
| POST | `/cart/applyCoupon` | Required | CUSTOMER | Apply coupon |
| POST | `/cart/estimate` | Required | CUSTOMER | Pre-checkout totals |
| POST | `/cart/mergeGuestCart` | Required | CUSTOMER | Merge after login |
| POST | `/cart/saveForLater` | Required | CUSTOMER | Move a cart line aside |
| POST | `/cart/savedForLater/{id}/moveToCart` | Required | CUSTOMER | Move a saved line back |

#### `/priceWatches`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/priceWatches/remove/{id}` | Required | CUSTOMER | Stop watching |
| GET | `/priceWatches/getAll` | Required | CUSTOMER | List price watches |
| POST | `/priceWatches/watch` | Required | CUSTOMER | Watch a product price |

#### `/categories`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/categories/deleteCategory/{id}` | Required | ADMIN | Delete |
| GET | `/categories/getAll` | Public | Public | List categories |
| GET | `/categories/getById/{id}` | Public | Public | Single category |
| GET | `/categories/getBySlug/{slug}` | Public | Public | Category by slug |
| PATCH | `/categories/updateCategory/{id}` | Required | ADMIN | Update |
| POST | `/categories/bulkCreate` | Required | ADMIN | Bulk create |
| POST | `/categories/createCategory` | Required | ADMIN | Create category |
| POST | `/categories/reorder` | Required | ADMIN | Drag sort |

#### `/chat`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/chat/deleteMessage/{id}` | Required | Any | Delete |
| GET | `/chat/getBlocked` | Required | Any | Blocked users |
| GET | `/chat/getConversations` | Required | Any | List threads |
| GET | `/chat/getMessages/{conversationId}` | Required | Any | Messages |
| GET | `/chat/getUnreadCount` | Required | Any | Badge |
| PATCH | `/chat/markRead/{conversationId}` | Required | Any | Read |
| POST | `/chat/blockUser/{userId}` | Required | Any | Block |
| POST | `/chat/sendMessage` | Required | Any | Send |
| POST | `/chat/startConversation` | Required | CUSTOMER | Start chat |
| POST | `/chat/unblock/{id}` | Required | Any | Remove block |

#### `/collections`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/collections/deleteCollection/{id}` | Required | ADMIN | Delete |
| GET | `/collections/getAll` | Public | Public | List collections |
| GET | `/collections/getById/{id}` | Public | Public | Single collection |
| GET | `/collections/getBySlug/{slug}` | Public | Public | Collection by slug |
| GET | `/collections/getProducts/{id}` | Public | Public | Collection products |
| PATCH | `/collections/updateCollection/{id}` | Required | ADMIN | Update |
| POST | `/collections/createCollection` | Required | ADMIN | Create collection |
| POST | `/collections/setProducts/{id}` | Required | Any | Replace products |

#### `/contact`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/contact/getAll` | Required | ADMIN | List submissions |
| PATCH | `/contact/{id}/markRead` | Required | ADMIN | Mark read |
| POST | `/contact/submit` | Public | Public | Contact form |

#### `/content`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/content/dropdowns/{id}/delete` | Required | ADMIN | Delete |
| GET | `/content/dropdowns` | Public | Public | List dropdowns |
| PATCH | `/content/dropdowns/{id}/update` | Required | ADMIN | Update |
| POST | `/content/dropdowns/create` | Required | ADMIN | Create |

#### `/countries`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/countries/getAll` | Public | Public | Countries |
| GET | `/countries/getCities/{stateCode}` | Public | Public | Cities |
| GET | `/countries/getStates/{countryCode}` | Public | Public | States |
| POST | `/countries/checkPincode` | Public | Public | Serviceability |
| POST | `/countries/seedCountries` | Required | ADMIN | Seed reference data |

#### `/coupons`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/coupons/vendorDeleteCoupon/{id}` | Required | VENDOR | Delete own coupon |
| GET | `/coupons/vendorCoupons` | Required | VENDOR | My store coupons |
| PATCH | `/coupons/vendorUpdateCoupon/{id}` | Required | VENDOR | Update own coupon |
| POST | `/coupons/vendorCreateCoupon` | Required | VENDOR | Create a store coupon |
| DELETE | `/coupons/deleteCoupon/{id}` | Required | ADMIN | Delete |
| GET | `/coupons/getAll` | Required | ADMIN | List coupons |
| GET | `/coupons/getById/{id}` | Required | ADMIN | Coupon detail |
| GET | `/coupons/getUsages/{id}` | Required | ADMIN | Usage list |
| PATCH | `/coupons/toggleStatus/{id}` | Required | ADMIN | Enable/Disable |
| PATCH | `/coupons/updateCoupon/{id}` | Required | ADMIN | Update |
| POST | `/coupons/applyCoupon` | Required | CUSTOMER | Apply coupon |
| POST | `/coupons/createCoupon` | Required | ADMIN | Create coupon |
| POST | `/coupons/validateCoupon` | Required | CUSTOMER | Validate code |

#### `/currencies`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/currencies/delete/{id}` | Required | ADMIN | Delete |
| GET | `/currencies/convert` | Public | Public | Convert amount |
| GET | `/currencies/getAll` | Public | Public | Currencies |
| PATCH | `/currencies/update/{id}` | Required | ADMIN | Update |
| POST | `/currencies/create` | Required | ADMIN | Create |

#### `/deliveryBoys`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/deliveryBoys/delete/{id}` | Required | ADMIN | Delete |
| GET | `/deliveryBoys/getAll` | Required | ADMIN | List boys |
| GET | `/deliveryBoys/getMyDeliveries` | Required | DELIVERY_BOY | Assigned |
| PATCH | `/deliveryBoys/toggleStatus/{id}` | Required | ADMIN | Active |
| PATCH | `/deliveryBoys/update/{id}` | Required | ADMIN | Update |
| PATCH | `/deliveryBoys/updateDeliveryStatus/{id}` | Required | DELIVERY_BOY | Update |
| POST | `/deliveryBoys/create` | Required | ADMIN | Create |

#### `/devices`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/devices/delete/{id}` | Required | ADMIN | Delete |
| GET | `/devices/getAll` | Required | ADMIN | All devices |
| GET | `/devices/getById/{id}` | Required | ADMIN | Detail |
| GET | `/devices/getByUser/{userId}` | Required | ADMIN | User devices |
| GET | `/devices/getTrusted` | Required | Any | My trusted |
| PATCH | `/devices/block/{id}` | Required | ADMIN | Block |
| PATCH | `/devices/trust/{id}` | Required | Any | Trust |
| PATCH | `/devices/unblock/{id}` | Required | ADMIN | Unblock |
| PATCH | `/devices/untrust/{id}` | Required | Any | Untrust |

#### `/faqs`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/faqs/delete/{id}` | Required | ADMIN | Delete |
| GET | `/faqs/getAll` | Public | Public | List FAQs |
| PATCH | `/faqs/update/{id}` | Required | ADMIN | Update |
| POST | `/faqs/create` | Required | ADMIN | Create FAQ |

#### `/flashSales`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/flashSales/delete/{id}` | Required | ADMIN | Delete |
| GET | `/flashSales/getActive` | Public | Public | Live sales |
| GET | `/flashSales/getAll` | Required | ADMIN | List flash sales |
| GET | `/flashSales/getBySlug/{slug}` | Public | Public | Flash sale by slug |
| PATCH | `/flashSales/update/{id}` | Required | ADMIN | Update |
| POST | `/flashSales/create` | Required | ADMIN | Flash sale |

#### `/giftCards`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/giftCards/delete/{id}` | Required | ADMIN | Delete |
| GET | `/giftCards/checkBalance/{code}` | Public | Public | Balance |
| GET | `/giftCards/getAll` | Required | ADMIN | List |
| PATCH | `/giftCards/disable/{id}` | Required | ADMIN | Disable |
| POST | `/giftCards/create` | Required | ADMIN | Create gift card |
| POST | `/giftCards/redeem` | Required | CUSTOMER | Redeem |

#### `/health`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/health/` | Public | Public | Liveness probe — does not touch the database |
| GET | `/health/db` | Public | Public | DB check |
| GET | `/health/jobs/{jobId}` | Required | Any | Job state |
| GET | `/health/queue` | Public | Public | Queue check |
| GET | `/health/redis` | Public | Public | Redis check |
| DELETE | `/i18n/delete/{id}` | Required | ADMIN | Delete |
| GET | `/i18n/getLocales` | Public | Public | Supported |
| GET | `/i18n/getTranslations/{locale}` | Public | Public | Strings |
| PATCH | `/i18n/update/{id}` | Required | ADMIN | Update |
| POST | `/i18n/bulkUpsert` | Required | ADMIN | Bulk |
| POST | `/i18n/create` | Required | ADMIN | Create |

#### `/loyalty`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/loyalty/getHistory` | Required | CUSTOMER | Points history |
| GET | `/loyalty/getPoints` | Required | CUSTOMER | Points balance |
| GET | `/loyalty/getTiers` | Public | Public | Tier config |
| POST | `/loyalty/adjust/{userId}` | Required | ADMIN | Adjust points |
| POST | `/loyalty/redeem` | Required | CUSTOMER | Redeem points |

#### `/newsletter`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/newsletter/getAll` | Required | ADMIN | Subscribers |
| POST | `/newsletter/sendCampaign` | Required | ADMIN | Blast |
| POST | `/newsletter/subscribe` | Public | Public | Subscribe |
| POST | `/newsletter/unsubscribe` | Public | Public | Unsubscribe |

#### `/notifications`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/notifications/delete/{id}` | Required | Any | Delete |
| DELETE | `/notifications/deleteTemplate/{id}` | Required | ADMIN | Delete |
| GET | `/notifications/getAll` | Required | Any | List notifications |
| GET | `/notifications/getPreferences` | Required | Any | Preferences |
| GET | `/notifications/getTemplates` | Required | ADMIN | Templates |
| GET | `/notifications/getUnreadCount` | Required | Any | Badge count |
| PATCH | `/notifications/markAllRead` | Required | Any | Mark all |
| PATCH | `/notifications/markRead/{id}` | Required | Any | Mark read |
| PATCH | `/notifications/updatePreferences` | Required | Any | Update prefs |
| PATCH | `/notifications/updateTemplate/{id}` | Required | ADMIN | Update |
| POST | `/notifications/createTemplate` | Required | ADMIN | Create template |
| POST | `/notifications/registerDevice` | Required | Any | Register FCM |
| POST | `/notifications/sendBulk` | Required | ADMIN | Bulk push |
| POST | `/notifications/unregisterDevice` | Required | Any | Remove FCM |

#### `/orders`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/orders/removeNote/{id}/{noteId}` | Required | ADMIN / VENDOR | Remove an internal order note |
| DELETE | `/orders/removeTag/{id}/{tagId}` | Required | ADMIN | Remove an order tag |
| GET | `/orders/getAll` | Required | CUSTOMER | My orders |
| GET | `/orders/getById/{id}` | Required | CUSTOMER | Order detail |
| GET | `/orders/getInvoice/{id}` | Required | CUSTOMER | Invoice PDF |
| GET | `/orders/getNotes/{id}` | Required | ADMIN / VENDOR | List internal order notes, newest first |
| GET | `/orders/getPackingSlip/{id}` | Required | VENDOR | Packing slip |
| GET | `/orders/getShippingLabel/{subOrderId}` | Required | VENDOR | Shipping label |
| GET | `/orders/getTags/{id}` | Required | ADMIN | List order tags |
| GET | `/orders/getTimeline/{id}` | Required | Any | Status history |
| GET | `/orders/getVendorOrders` | Required | VENDOR | My sub-orders |
| GET | `/orders/track/{id}` | Public | Any | Live tracking |
| PATCH | `/orders/approveReturn/{returnId}` | Required | VENDOR / ADMIN | Approve return |
| PATCH | `/orders/assignDeliveryBoy/{subOrderId}` | Required | ADMIN | Assign |
| PATCH | `/orders/rejectReturn/{returnId}` | Required | VENDOR / ADMIN | Reject return |
| PATCH | `/orders/updateStatus/{id}` | Required | ADMIN | Update order status |
| PATCH | `/orders/updateVendorStatus/{subOrderId}` | Required | VENDOR | Update sub-order |
| POST | `/orders/addNote/{id}` | Required | ADMIN / VENDOR | Add an internal order note (hidden from the customer) |
| POST | `/orders/addTags/{id}` | Required | ADMIN | Add order tags (order id or order number in `{id}`) |
| POST | `/orders/cancelOrder/{id}` | Required | CUSTOMER | Cancel order |
| POST | `/orders/placeOrder` | Required | CUSTOMER | Place order |
| POST | `/orders/reorder/{id}` | Required | CUSTOMER | Re-order |
| POST | `/orders/returnRequest/{id}` | Required | CUSTOMER | Return request |
| POST | `/orders/verifyDeliveryOtp/{subOrderId}` | Required | VENDOR / ADMIN | OTP confirm delivery |
| POST | `/orders/vendorBulkStatusUpdate` | Required | VENDOR | Bulk accept/reject sub-orders |

#### `/pages`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/pages/delete/{id}` | Required | ADMIN | Delete |
| GET | `/pages/getAll` | Public | Public | List pages |
| GET | `/pages/getBySlug/{slug}` | Public | Public | Detail |
| PATCH | `/pages/update/{id}` | Required | ADMIN | Update |
| POST | `/pages/create` | Required | ADMIN | Create page |

#### `/payments`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/payments/getAll` | Required | ADMIN | All payments |
| GET | `/payments/getByOrder/{orderId}` | Required | CUSTOMER | Payment info |
| GET | `/payments/getRefundHistory/{orderId}` | Required | CUSTOMER | Refund history |
| GET | `/payments/methods` | Public | Public | Available methods |
| GET | `/payments/walletBalance` | Required | CUSTOMER | Wallet balance |
| PATCH | `/payments/confirmPayment/{id}` | Required | ADMIN | Manual confirm |
| PATCH | `/payments/markCodCollected/{orderId}` | Required | VENDOR | COD collected |
| POST | `/payments/payBalance/{orderId}` | Required | CUSTOMER | Pay balance |
| POST | `/payments/payToken/{orderId}` | Required | CUSTOMER | Pay token amount |
| POST | `/payments/razorpay/createOrder` | Required | CUSTOMER | Razorpay init |
| POST | `/payments/razorpay/verify` | Required | CUSTOMER | Verify signature |
| POST | `/payments/refund/{id}` | Required | ADMIN | Refund |
| POST | `/payments/stripe/createIntent` | Required | CUSTOMER | Stripe init |
| POST | `/payments/verifyBank/{orderId}` | Required | CUSTOMER | Bank slip |
| POST | `/payments/verifyUpi/{orderId}` | Required | CUSTOMER | UPI reference |

#### `/payouts`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/payouts/getAll` | Required | ADMIN | All payouts |
| GET | `/payouts/getPendingAmount/{vendorId}` | Required | VENDOR | Pending |
| GET | `/payouts/getStatement/{vendorId}` | Required | ADMIN | Statement PDF |
| GET | `/payouts/getSummary` | Required | ADMIN | Totals |
| GET | `/payouts/getVendorEarnings` | Required | VENDOR | My earnings |
| PATCH | `/payouts/approvePayout/{id}` | Required | ADMIN | Approve payout |
| PATCH | `/payouts/rejectPayout/{id}` | Required | ADMIN | Reject payout |
| PATCH | `/payouts/updateStatus/{id}` | Required | ADMIN | Generic update |
| POST | `/payouts/bulkApprove` | Required | ADMIN | Bulk approve |
| POST | `/payouts/generateCycles` | Required | ADMIN | Batch calc |

#### `/products`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/products/deleteImage/{id}/{imageId}` | Required | VENDOR | Remove image |
| DELETE | `/products/deleteProduct/{id}` | Required | VENDOR | Soft delete |
| GET | `/products/exportCsv` | Required | VENDOR | Export |
| GET | `/products/getAll` | Public | Public | List products (paginated) |
| GET | `/products/getById/{id}` | Public | Public | Single product |
| GET | `/products/getBySlug/{slug}` | Public | Public | SEO URL product |
| GET | `/products/getFilters` | Public | Public | Facets |
| GET | `/products/getFrequentlyBought/{id}` | Public | Public | Frequently bought |
| GET | `/products/getRecentlyViewed` | Required | Any | Recently viewed |
| GET | `/products/getRecommended` | Required | Any | Recommendations |
| GET | `/products/getRelated/{id}` | Public | Public | Related products |
| PATCH | `/products/bulkDelete` | Required | VENDOR | Bulk delete |
| PATCH | `/products/bulkUpdate` | Required | VENDOR | Bulk edit |
| PATCH | `/products/toggleStatus/{id}` | Required | VENDOR | Active/Inactive |
| PATCH | `/products/updateProduct/{id}` | Required | VENDOR | Update own product |
| PATCH | `/products/updateStock/{id}` | Required | VENDOR | Update stock |
| POST | `/products/bulkCreate` | Required | VENDOR | Bulk create |
| POST | `/products/bulkImportCsv` | Required | VENDOR | CSV import |
| POST | `/products/bulkPriceUpdate` | Required | VENDOR | Bulk price update |
| POST | `/products/createProduct` | Required | VENDOR | Create product |
| POST | `/products/trackView/{id}` | Public | Any | Increment view |
| POST | `/products/uploadImages/{id}` | Required | VENDOR | Upload images |

#### `/questions`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/questions/delete/{id}` | Required | ADMIN / CUSTOMER | Delete |
| GET | `/questions/getAll/{productId}` | Public | Public | List Q&A |
| PATCH | `/questions/approve/{id}` | Required | ADMIN | Approve |
| POST | `/questions/answer/{id}` | Required | VENDOR | Answer |
| POST | `/questions/ask` | Required | CUSTOMER | Ask question |

#### `/referral`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/referral/admin/getAll` | Required | ADMIN | All referrals |
| GET | `/referral/getLeaderboard` | Required | CUSTOMER | Leaderboard |
| GET | `/referral/getMyCode` | Required | CUSTOMER | My code |
| GET | `/referral/getRewards` | Required | CUSTOMER | My rewards |
| PATCH | `/referral/updateStatus/{id}` | Required | ADMIN | Update status |
| POST | `/referral/applyCode` | Required | CUSTOMER | Apply code |
| POST | `/referral/complete/{id}` | Required | ADMIN | Mark complete |

#### `/reports`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/reports/schedule/{id}/delete` | Required | ADMIN | Delete schedule |
| GET | `/reports/customers` | Required | ADMIN | Customers |
| GET | `/reports/export/{type}` | Required | ADMIN | CSV/XLSX |
| GET | `/reports/getSchedules` | Required | ADMIN | Schedule list |
| GET | `/reports/inventory` | Required | VENDOR | Stock |
| GET | `/reports/orders` | Required | ADMIN | Orders |
| GET | `/reports/payouts` | Required | ADMIN | Payouts |
| GET | `/reports/products` | Required | VENDOR / ADMIN | Products |
| GET | `/reports/returns` | Required | ADMIN | Returns |
| GET | `/reports/sales` | Required | ADMIN | Sales |
| GET | `/reports/tax` | Required | ADMIN | GST |
| GET | `/reports/vendors` | Required | ADMIN | Vendors |
| PATCH | `/reports/schedule/{id}/update` | Required | ADMIN | Update schedule |
| POST | `/reports/schedule` | Required | ADMIN | Schedule email |

#### `/returns`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/returns/getAll` | Required | ADMIN / VENDOR | List |
| GET | `/returns/getById/{id}` | Required | Any | Detail |
| GET | `/returns/getReasons` | Public | Public | Reason list |
| PATCH | `/returns/approve/{id}` | Required | ADMIN / VENDOR | Approve |
| PATCH | `/returns/markPickedUp/{id}` | Required | VENDOR | Picked up |
| PATCH | `/returns/markReceived/{id}` | Required | VENDOR | Received |
| PATCH | `/returns/processRefund/{id}` | Required | ADMIN | Refund |
| PATCH | `/returns/reject/{id}` | Required | ADMIN / VENDOR | Reject |
| POST | `/returns/addReason` | Required | ADMIN | Add reason |
| POST | `/returns/createRequest` | Required | CUSTOMER | Create return |

#### `/reviews`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/reviews/deleteReview/{id}` | Required | CUSTOMER | Delete own |
| GET | `/reviews/getAll` | Public | Public | List reviews |
| GET | `/reviews/getSummary/{productId}` | Public | Public | Rating breakdown |
| PATCH | `/reviews/approve/{id}` | Required | ADMIN | Approve |
| PATCH | `/reviews/reject/{id}` | Required | ADMIN | Reject |
| PATCH | `/reviews/updateReview/{id}` | Required | CUSTOMER | Update own |
| POST | `/reviews/addReview` | Required | CUSTOMER | Add review |
| POST | `/reviews/reply/{id}` | Required | VENDOR | Vendor reply |
| POST | `/reviews/voteHelpful/{id}` | Required | Any | Helpful vote |

#### `/search`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/search/recent/clear` | Required | Any | Clear |
| GET | `/search/autocomplete` | Public | Public | Suggestions |
| GET | `/search/global` | Public | Public | Multi-entity |
| GET | `/search/products` | Public | Public | Product search |
| GET | `/search/recent` | Required | Any | Recent |
| GET | `/search/trending` | Public | Public | Trending |
| GET | `/search/vendors` | Public | Public | Vendor search |

#### `/settings`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/settings/getAll` | Required | ADMIN | All settings |
| GET | `/settings/getByCategory/{category}` | Required | ADMIN | By category |
| GET | `/settings/getFeatureFlags` | Public | Public | Feature toggles |
| GET | `/settings/getMaintenance` | Public | Public | Maintenance status |
| GET | `/settings/getPublicSettings` | Public | Public | Public config |
| PATCH | `/settings/toggleFeature` | Required | ADMIN | Toggle |
| PATCH | `/settings/updateMaintenance` | Required | SUPER_ADMIN | Toggle |
| PATCH | `/settings/updateSetting` | Required | ADMIN | Update one |
| POST | `/settings/bulkUpdateSettings` | Required | ADMIN | Bulk update |
| POST | `/settings/resetToDefault` | Required | SUPER_ADMIN | Reset |

#### `/shipping`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/shipping/deleteMethod/{id}` | Required | ADMIN | Delete |
| DELETE | `/shipping/deleteZone/{id}` | Required | ADMIN | Delete |
| GET | `/shipping/getMethods` | Public | Public | Methods |
| GET | `/shipping/getPartners` | Required | ADMIN | List |
| GET | `/shipping/getZones` | Required | ADMIN | Zones |
| GET | `/shipping/track/{awb}` | Public | Any | Track |
| PATCH | `/shipping/updateMethod/{id}` | Required | ADMIN | Update |
| PATCH | `/shipping/updatePartner/{id}` | Required | ADMIN | Update partner |
| PATCH | `/shipping/updateStatus/{id}` | Required | VENDOR / ADMIN | Update |
| PATCH | `/shipping/updateZone/{id}` | Required | ADMIN | Update |
| POST | `/shipping/calculateRate` | Required | CUSTOMER | Rate calc |
| POST | `/shipping/checkServiceability` | Public | Public | Pincode check |
| POST | `/shipping/createMethod` | Required | ADMIN | Method |
| POST | `/shipping/createPartner` | Required | ADMIN | Partner |
| POST | `/shipping/createShipment/{subOrderId}` | Required | VENDOR | Create |
| POST | `/shipping/createZone` | Required | ADMIN | Create zone |

#### `/tags`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/tags/deleteTag/{id}` | Required | ADMIN | Delete |
| GET | `/tags/getAll` | Public | Public | List tags |
| POST | `/tags/bulkCreate` | Required | Any | Bulk create |
| POST | `/tags/createTag` | Required | ADMIN | Create tag |

#### `/tax`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/tax/delete/{id}` | Required | ADMIN | Delete |
| GET | `/tax/getConfigs` | Required | ADMIN | Tax rules |
| PATCH | `/tax/update/{id}` | Required | ADMIN | Update |
| POST | `/tax/create` | Required | ADMIN | Create |

#### `/templates`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/templates/email/{key}/delete` | Required | ADMIN | Delete |
| DELETE | `/templates/notification/{key}/delete` | Required | ADMIN | Delete |
| DELETE | `/templates/sms/{key}/delete` | Required | ADMIN | Delete |
| GET | `/templates/email/getAll` | Required | ADMIN | List email templates |
| GET | `/templates/notification/getAll` | Required | ADMIN | List notification templates |
| GET | `/templates/sms/getAll` | Required | ADMIN | List SMS templates |
| POST | `/templates/email/upsert` | Required | ADMIN | Create or update |
| POST | `/templates/email/{key}/render` | Required | ADMIN | Render with values |
| POST | `/templates/notification/upsert` | Required | ADMIN | Create or update |
| POST | `/templates/notification/{key}/render` | Required | ADMIN | Render with values |
| POST | `/templates/sms/upsert` | Required | ADMIN | Create or update |
| POST | `/templates/sms/{key}/render` | Required | ADMIN | Render with values |

#### `/tickets`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/tickets/delete/{id}` | Required | ADMIN | Delete |
| DELETE | `/tickets/removeNote/{id}/{noteId}` | Required | — | Remove an internal ticket note |
| GET | `/tickets/getAll` | Required | Any | List |
| GET | `/tickets/getById/{id}` | Required | Any | Detail |
| GET | `/tickets/getCategories` | Public | Public | Categories |
| GET | `/tickets/getNotes/{id}` | Required | — | List internal ticket notes |
| GET | `/tickets/getStats` | Required | ADMIN | Ticket counts by status |
| PATCH | `/tickets/assign/{id}` | Required | ADMIN | Assign |
| PATCH | `/tickets/close/{id}` | Required | Any | Close |
| PATCH | `/tickets/updateStatus/{id}` | Required | ADMIN | Status |
| POST | `/tickets/addNote/{id}` | Required | — | Add an internal ticket note |
| POST | `/tickets/categories` | Required | ADMIN | Create ticket category |
| POST | `/tickets/create` | Required | Any | Create ticket |
| POST | `/tickets/reply/{id}` | Required | Any | Reply |

#### `/track`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/track/appInstall` | Public | Public | App install |
| POST | `/track/appOpen` | Public | Any | App open |
| POST | `/track/click` | Public | Any | Click |
| POST | `/track/conversion` | Public | Any | Conversion |
| POST | `/track/crash` | Public | Any | Crash report |
| POST | `/track/device` | Public | Any | Register device |
| POST | `/track/error` | Public | Any | JS/API error |
| POST | `/track/event` | Public | Any | Generic event |
| POST | `/track/funnel` | Public | Any | Funnel step |
| POST | `/track/heartbeat` | Public | Any | Keep alive |
| POST | `/track/pageView` | Public | Any | Page view |
| POST | `/track/performance` | Public | Any | Perf metrics |
| POST | `/track/referrer` | Public | Any | Referrer |
| POST | `/track/scroll` | Public | Any | Scroll depth |
| POST | `/track/search` | Public | Any | Search |
| POST | `/track/session/end` | Public | Any | Session end |
| POST | `/track/session/start` | Public | Any | Session start |
| POST | `/track/utm` | Public | Any | UTM |

#### `/uploads`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/uploads/getSignedUrl` | Required | Any | Direct upload |
| POST | `/uploads/deleteFile` | Required | Any | Delete |
| POST | `/uploads/uploadDocument` | Required | Any | Upload doc |
| POST | `/uploads/uploadImage` | Required | Any | Upload image |
| POST | `/uploads/uploadImage/single` | Required | Any | Single file upload |
| POST | `/uploads/uploadMultiple` | Required | Any | Bulk |
| POST | `/uploads/uploadVideo` | Required | Any | Upload video |

#### `/users`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/users/deleteAccount` | Required | Any | Soft-delete self — recoverable for `security.accountPurgeDays` |
| DELETE | `/users/deleteAddress/{id}` | Required | CUSTOMER | Delete address |
| DELETE | `/users/deleteUser/{id}` | Required | SUPER_ADMIN | Hard delete |
| DELETE | `/users/deleteSegment/{id}` | Required | ADMIN | Delete segment |
| DELETE | `/users/removeNote/{id}/{noteId}` | Required | ADMIN | Internal note remove |
| GET | `/users/exportData/{id}` | Required | ADMIN | Export one customer |
| GET | `/users/exportMyData` | Required | Any | DPDP self-service export |
| GET | `/users/getActivity/{id}` | Required | ADMIN | User activity |
| GET | `/users/getAddresses` | Required | CUSTOMER | List addresses |
| GET | `/users/getAll` | Required | ADMIN | List users |
| GET | `/users/getBans` | Required | ADMIN | Blocked customers |
| GET | `/users/getById/{id}` | Required | ADMIN | Single user |
| GET | `/users/getNotes/{id}` | Required | ADMIN | Internal notes list |
| GET | `/users/getOrders/{id}` | Required | ADMIN | User orders |
| GET | `/users/getProfile` | Required | Any | Self profile |
| GET | `/users/getSegmentById/{id}` | Required | ADMIN | Segment detail |
| GET | `/users/getSegmentMembers/{id}` | Required | ADMIN | Segment members |
| GET | `/users/getSegments` | Required | ADMIN | List segments |
| GET | `/users/getTimeline/{id}` | Required | ADMIN | Unified timeline |
| PATCH | `/users/setDefaultAddress/{id}` | Required | CUSTOMER | Set default |
| PATCH | `/users/toggleStatus/{id}` | Required | ADMIN | Suspend/activate |
| PATCH | `/users/updateAddress/{id}` | Required | CUSTOMER | Update address |
| PATCH | `/users/updateAvatar` | Public | Public | Change avatar |
| PATCH | `/users/updateProfile` | Required | Any | Update self profile |
| PATCH | `/users/updateSegment/{id}` | Required | ADMIN | Update segment |
| PATCH | `/users/updateUser/{id}` | Required | ADMIN | Update user |
| POST | `/users/addAddress` | Required | CUSTOMER | Add address |
| POST | `/users/addNote/{id}` | Required | ADMIN | Internal note add |
| POST | `/users/addSegmentMembers/{id}` | Required | ADMIN | Add members |
| POST | `/users/banCustomer/{id}` | Required | ADMIN | Block a customer (reason + duration) |
| POST | `/users/createSegment` | Required | ADMIN | Create a manual segment |
| POST | `/users/impersonate/{id}` | Required | SUPER_ADMIN | Login as user |
| POST | `/users/refreshSegments` | Required | ADMIN | Recompute auto segments now |
| POST | `/users/removeSegmentMembers/{id}` | Required | ADMIN | Remove members |
| POST | `/users/unbanCustomer/{id}` | Required | ADMIN | Lift a block |

#### `/vendors`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/vendors/deleteAnnouncement/{id}` | Required | VENDOR | Delete announcement |
| DELETE | `/vendors/unblockCustomer/{userId}` | Required | VENDOR | Unblock |
| GET | `/vendors/getAnnouncements` | Required | VENDOR | Own announcements |
| GET | `/vendors/getAll` | Required | ADMIN | List vendors |
| GET | `/vendors/getBlockedCustomers` | Required | VENDOR | Blocked customers |
| GET | `/vendors/getById/{id}` | Required | ADMIN | Single vendor |
| GET | `/vendors/getDocuments` | Required | ADMIN | KYC docs |
| GET | `/vendors/getPayoutHistory` | Required | VENDOR | Payout history |
| GET | `/vendors/getProducts/{id}` | Public | Public | Vendor products |
| GET | `/vendors/getProfile` | Required | VENDOR | My vendor profile |
| GET | `/vendors/getRatings/{id}` | Public | Public | Vendor rating summary |
| GET | `/vendors/getStats` | Required | VENDOR | Dashboard stats |
| GET | `/vendors/getStore/{slug}` | Public | Public | Storefront page |
| PATCH | `/vendors/approveVendor/{id}` | Required | ADMIN | Approve vendor |
| PATCH | `/vendors/rejectVendor/{id}` | Required | ADMIN | Reject vendor |
| PATCH | `/vendors/suspendVendor/{id}` | Required | ADMIN | Suspend vendor |
| PATCH | `/vendors/updateAnnouncement/{id}` | Required | VENDOR | Update announcement |
| PATCH | `/vendors/updateBankDetails/{id}` | Required | VENDOR | Update bank/UPI |
| PATCH | `/vendors/updateCommission/{id}` | Required | ADMIN | Override commission |
| PATCH | `/vendors/updateProfile` | Required | VENDOR | Update vendor profile |
| PATCH | `/vendors/updateVacation/{id}` | Required | VENDOR | Vacation mode |
| PATCH | `/vendors/verifyDocuments/{id}` | Required | ADMIN | Approve KYC |
| POST | `/vendors/blockCustomer/{userId}` | Required | VENDOR | Block a customer |
| POST | `/vendors/createAnnouncement` | Required | VENDOR | Create announcement |
| POST | `/vendors/requestPayout` | Required | VENDOR | Request payout |
| POST | `/vendors/uploadDocuments` | Required | VENDOR | KYC docs |

#### `/version`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/version/` | — | — | API version |

#### `/wallet`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/wallet/getBalance` | Required | CUSTOMER | Balance |
| GET | `/wallet/getTransactions` | Required | CUSTOMER | History |
| POST | `/wallet/addMoney` | Required | CUSTOMER | Top-up |
| POST | `/wallet/adminCredit` | Required | ADMIN | Manual credit |
| POST | `/wallet/adminDebit` | Required | ADMIN | Manual debit |
| POST | `/wallet/useForOrder` | Required | CUSTOMER | Redeem at checkout |

#### `/webhooks`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/webhooks/delete/{id}` | Required | ADMIN | Delete |
| GET | `/webhooks/getAll` | Required | ADMIN | List |
| GET | `/webhooks/getLogs` | Required | ADMIN | Incoming log |
| PATCH | `/webhooks/{id}/update` | Required | ADMIN | Update |
| POST | `/webhooks/payment-gateway/{provider}` | Signature | Webhook | Generic |
| POST | `/webhooks/razorpay` | Signature | Webhook | Razorpay |
| POST | `/webhooks/register` | Required | ADMIN | Outgoing URL |
| POST | `/webhooks/shipping` | Signature | Webhook | Shipping |
| POST | `/webhooks/{id}/rotateSecret` | Required | ADMIN | Rotate secret |

#### `/wishlist`

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| DELETE | `/wishlist/clear` | Required | CUSTOMER | Clear |
| DELETE | `/wishlist/removeItem/{id}` | Required | CUSTOMER | Remove |
| GET | `/wishlist/checkProduct/{productId}` | Required | Any | Is wishlisted |
| GET | `/wishlist/getAll` | Required | CUSTOMER | List wishlist |
| POST | `/wishlist/addItem` | Required | CUSTOMER | Add to wishlist |
| POST | `/wishlist/moveToCart/{id}` | Required | CUSTOMER | Move to cart |

---

## Part F — Sample requests and responses

Every response follows the envelope (`status`, `message`, `result`); the rules are in `AGENTS.md`. Refresh tokens are never in the body — they arrive in an HttpOnly cookie (`Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`).

### Register — customer

Three steps: first prove the contact, then create the account against that proof.

**Step 1 — send the code**

```
POST /api/v1/auth/register/sendOtp
Content-Type: application/json

{
  "identifier": "ravi@example.com"
}
```

`200 OK`

```json
{
  "status": true,
  "message": "OTP sent successfully.",
  "result": {
    "identifier": "ravi@example.com",
    "channel": "EMAIL",
    "expiresIn": 600,
    "otpLength": 6,
    "isNewUser": true
  }
}
```

**Step 2 — verify the code**

```
POST /api/v1/auth/register/verifyOtp
Content-Type: application/json

{
  "identifier": "ravi@example.com",
  "otp": "123456"
}
```

`200 OK`

```json
{
  "status": true,
  "message": "OTP verified successfully.",
  "result": {
    "verificationToken": "9f2a41c7...",
    "expiresIn": 900,
    "identifier": "ravi@example.com",
    "otpLength": 6
  }
}
```

**Step 3 — send the details and create the account**

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "type": "CUSTOMER",
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "phone": "+919876543210",
  "password": "Secret@123",
  "verificationToken": "9f2a41c7..."
}
```

`201 Created`

```json
{
  "status": true,
  "message": "Customer registered successfully.",
  "result": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900,
    "userData": {
      "userId": "usr_1",
      "name": "Ravi Kumar",
      "email": "ravi@example.com",
      "phone": "+919876543210",
      "isActive": true,
      "isEmailVerified": true,
      "isPhoneVerified": false
    },
    "rolesList": ["CUSTOMER"]
  }
}
```

Step 2 only checks the code — no account is created and no session is issued. The `verificationToken` is the permission for step 3; see [B1](#b1-authentication-and-otp) for what it binds. With `OTP_REQUIRED=false` no token is needed: the account is created immediately and the verified flags stay false.

### Register — vendor

The same three steps; step 3 adds `shopName` (and optionally `slug`).

```
POST /api/v1/auth/register/sendOtp
{ "identifier": "ravi@example.com" }
```

```
POST /api/v1/auth/register/verifyOtp
{ "identifier": "ravi@example.com", "otp": "123456" }
```

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "type": "VENDOR",
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "phone": "+919876543210",
  "password": "Secret@123",
  "verificationToken": "9f2a41c7...",
  "shopName": "Ravi Store",
  "slug": "ravi-store"
}
```

`201 Created`

```json
{
  "status": true,
  "message": "Vendor registered successfully.",
  "result": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900,
    "userData": {
      "userId": "usr_1",
      "name": "Ravi Kumar",
      "email": "ravi@example.com",
      "phone": "+919876543210",
      "isActive": true
    },
    "vendorData": {
      "vendorId": "v_1",
      "shopName": "Ravi Store",
      "slug": "ravi-store",
      "status": "PENDING"
    },
    "rolesList": ["VENDOR"]
  }
}
```

If `vendor.autoApprove = true`, `vendorData.status` is `"APPROVED"`. Otherwise the vendor cannot create products (403 `VENDOR_NOT_APPROVED`).

### Login — password

One call. The user sends email or phone plus password and the server issues the session directly.

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "ravi@example.com",
  "password": "Secret@123"
}
```

`200 OK`

```json
{
  "status": true,
  "message": "Logged in successfully.",
  "result": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900,
    "twoFactorRequired": false,
    "userData": {
      "userId": "usr_1",
      "name": "Ravi Kumar",
      "email": "ravi@example.com",
      "rolesList": ["CUSTOMER"]
    }
  }
}
```

`email` or `phone` — either works. This endpoint takes only a password; there is no `otp` or `type` field (use OTP login for that). If `twoFactorRequired` is `true`, the tokens are empty and a `twoFactorToken` is returned, which goes to `POST /auth/verify2FA`. `revokedSessionCount` reports how many older sessions the `security.maxActiveSessions` cap closed; it is `0` by default (see [B2](#b2-account-security)).

### Login — OTP

Two steps; the code and the session arrive in the same call.

**Step 1 — send the code**

```
POST /api/v1/auth/sendOtp
Content-Type: application/json

{
  "type": "LOGIN",
  "channel": "EMAIL",
  "identifier": "ravi@example.com"
}
```

`200 OK`

```json
{
  "status": true,
  "result": {
    "identifier": "ravi@example.com",
    "channel": "EMAIL",
    "expiresIn": 600,
    "otpLength": 6,
    "isNewUser": false
  }
}
```

**Step 2 — verify the code and sign in**

```
POST /api/v1/auth/login/verifyOtp
Content-Type: application/json

{
  "identifier": "ravi@example.com",
  "otp": "123456"
}
```

`200 OK`

```json
{
  "status": true,
  "message": "Logged in successfully.",
  "result": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900,
    "twoFactorRequired": false,
    "userData": {
      "userId": "usr_1",
      "name": "Ravi Kumar",
      "email": "ravi@example.com",
      "rolesList": ["CUSTOMER"]
    }
  }
}
```

The session is always created for the contact whose code was verified, so no `verificationToken` is needed here. The code is single-use — sending it again is 401 `OTP_INVALID`.

### List categories (simple paginated)

```
GET /api/v1/categories/getAll?page=1&limit=20
```

`200 OK`

```json
{
  "status": true,
  "message": "Categories retrieved successfully.",
  "result": {
    "totalRecord": 5,
    "totalPage": 1,
    "currentPage": 1,
    "limit": 20,
    "hasNext": false,
    "hasPrevious": false,
    "nextPage": 0,
    "previousPage": 0,
    "categoryList": []
  }
}
```

### List products (filters and pagination)

```
GET /api/v1/products/getAll?page=1&limit=20&sort=-createdAt&search=shirt&category=men&minPrice=100&maxPrice=2000
```

`200 OK`

```json
{
  "status": true,
  "message": "Products fetched successfully.",
  "result": {
    "totalRecord": 145,
    "totalPage": 8,
    "currentPage": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrevious": false,
    "nextPage": 2,
    "previousPage": 0,
    "filterData": {
      "search": "shirt",
      "category": "men",
      "minPrice": 100,
      "maxPrice": 2000
    },
    "productList": [
      {
        "productId": "prod_1",
        "name": "Blue Shirt",
        "price": 799,
        "stock": 25,
        "isActive": true,
        "categoryData": { "categoryId": "cat_1", "name": "Men" },
        "vendorData": { "vendorId": "v_1", "shopName": "Ravi Store" },
        "imageList": ["url1.jpg"],
        "reviewList": []
      }
    ]
  }
}
```

### Validation error

```
POST /api/v1/auth/register
{ "type": "CUSTOMER", "email": "not-an-email" }
```

`400 Bad Request`

```json
{
  "status": false,
  "message": "Please enter a valid email address. Error Code (VALIDATION_ERROR)",
  "result": {}
}
```

### Not found

```
GET /api/v1/products/getById/unknown-id
```

`404 Not Found`

```json
{
  "status": false,
  "message": "Product not found. Error Code (NOT_FOUND)",
  "result": {}
}
```

### Place order (multi-vendor split)

```json
{
  "status": true,
  "message": "Order placed successfully.",
  "result": {
    "orderId": "ord_1",
    "total": 1598,
    "status": "PENDING",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "addressData": {
      "line1": "123 Main St",
      "city": "Delhi",
      "pincode": "110001"
    },
    "subOrderList": [
      {
        "subOrderId": "sub_1",
        "vendorId": "v_1",
        "subtotal": 799,
        "commission": 79.9,
        "vendorEarning": 719.1,
        "status": "PENDING",
        "itemList": [{ "productId": "p_1", "qty": 1, "price": 799 }]
      },
      {
        "subOrderId": "sub_2",
        "vendorId": "v_2",
        "subtotal": 799,
        "commission": 79.9,
        "vendorEarning": 719.1,
        "status": "PENDING",
        "itemList": [{ "productId": "p_2", "qty": 1, "price": 799 }]
      }
    ]
  }
}
```

`subOrderList` is a list but carries no pagination numbers — it belongs to a single order.

### Token order response

```json
{
  "status": true,
  "message": "Order placed successfully. Token payment required.",
  "result": {
    "orderId": "ord_1",
    "total": 2000,
    "tokenRequired": true,
    "tokenAmount": 400,
    "balanceAmount": 1600,
    "balanceDueDays": 7,
    "status": "PENDING_TOKEN",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "paymentData": {
      "method": "UPI",
      "status": "PENDING",
      "tokenPaid": false,
      "allowedMethods": ["UPI", "CARD", "NETBANKING"]
    },
    "addressData": {
      "line1": "123 Main St",
      "city": "Delhi",
      "pincode": "110001"
    },
    "subOrderList": []
  }
}
```

### Track event (client → server)

```
POST /api/v1/track/event
Content-Type: application/json

{
  "eventName": "add_to_cart",
  "eventData": { "productId": "prod_1", "qty": 2, "price": 799 },
  "sessionId": "sess_abc",
  "userId": "usr_1",
  "pageUrl": "/products/blue-shirt",
  "referrer": "https://google.com",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "deviceData": {
    "deviceId": "dev_uuid",
    "platform": "ANDROID",
    "os": "Android",
    "osVersion": "13.0",
    "browser": "",
    "browserVersion": "",
    "model": "Pixel 7",
    "manufacturer": "Google",
    "screenWidth": 1080,
    "screenHeight": 2340,
    "locale": "en-IN",
    "timezone": "Asia/Kolkata",
    "appVersion": "1.2.3"
  }
}
```

`200 OK`

```json
{
  "status": true,
  "message": "Event tracked successfully.",
  "result": {
    "eventId": "evt_1",
    "receivedAt": "2025-01-15T10:30:01.000Z"
  }
}
```

### Analytics overview

```
GET /api/v1/analytics/getOverview?from=2025-01-01&to=2025-01-31
```

`200 OK`

```json
{
  "status": true,
  "message": "Analytics overview fetched.",
  "result": {
    "totalUsers": 12000,
    "newUsers": 850,
    "totalOrders": 3200,
    "totalRevenue": 4560000,
    "averageOrderValue": 1425.0,
    "conversionRate": 3.45,
    "visitorsData": {
      "uniqueVisitors": 45000,
      "pageViews": 180000,
      "sessions": 62000,
      "bounceRate": 42.5,
      "avgSessionDuration": 245
    },
    "deviceBreakdownData": {
      "android": 55.2,
      "ios": 28.7,
      "web": 16.1
    },
    "topPagesList": [
      { "pageUrl": "/", "views": 45000 },
      { "pageUrl": "/products", "views": 32000 }
    ],
    "topCountriesList": [
      { "country": "IN", "visitors": 40000 },
      { "country": "US", "visitors": 3000 }
    ]
  }
}
```

### Device registration

```
POST /api/v1/track/device
Content-Type: application/json

{
  "deviceId": "dev_uuid",
  "platform": "IOS",
  "os": "iOS",
  "osVersion": "17.2",
  "model": "iPhone 15",
  "manufacturer": "Apple",
  "appVersion": "1.2.3",
  "fcmToken": "fcm_token_here",
  "locale": "en-IN",
  "timezone": "Asia/Kolkata"
}
```

`200 OK`

```json
{
  "status": true,
  "message": "Device registered.",
  "result": {
    "deviceId": "dev_uuid",
    "isTrusted": false,
    "registeredAt": "2025-01-15T10:30:00.000Z"
  }
}
```
