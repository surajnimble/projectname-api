# AGENTS — Development Guide

One reference for anyone changing this codebase — agent or human. Each section shows how to do the thing, then immediately what not to do. Read it once before your first edit.

For what the system does — features, business rules, config defaults, edge cases, endpoints — see [`FEATURES.md`](FEATURES.md). For running, testing and deploying it, see [`README.md`](README.md). For the endpoint contract, see `GET /api/v1/docs.json`.

## Contents

1. [Before you write a line](#1-before-you-write-a-line)
2. [Module shape](#2-module-shape)
3. [Adding a feature — worked example](#3-adding-a-feature--worked-example)
4. [Response envelope](#4-response-envelope)
5. [Error response](#5-error-response)
6. [Pagination](#6-pagination)
7. [No-null policy](#7-no-null-policy)
8. [Key ordering inside every object](#8-key-ordering-inside-every-object)
9. [Endpoint naming](#9-endpoint-naming)
10. [Constants, messages, config](#10-constants-messages-config)
11. [Helper classes](#11-helper-classes)
12. [Serializers](#12-serializers)
13. [Comments](#13-comments)
14. [Security](#14-security)
15. [Encryption](#15-encryption)
16. [Tracking and analytics](#16-tracking-and-analytics)
17. [Chat, socket, wallet](#17-chat-socket-wallet)
18. [Config defaults and seeding](#18-config-defaults-and-seeding)
19. [Testing and hygiene](#19-testing-and-hygiene)
20. [Migrations](#20-migrations)
21. [Commands](#21-commands)
22. [Edge cases](#22-edge-cases)
23. [HTTP status codes](#23-http-status-codes)
24. [Pre-push checklist](#24-pre-push-checklist)
25. [Working method](#25-working-method)
- [Appendix A — Constants excerpt](#appendix-a--constants-excerpt)
- [Appendix B — Message catalogue excerpt](#appendix-b--message-catalogue-excerpt)

---

## 1. Before you write a line

Read the module you are about to touch, end to end. This codebase is unusually consistent on purpose; matching the surrounding style is part of the job.

| Your task | Read first |
| --- | --- |
| Write or change code | this file |
| Understand a behaviour, a business rule, a default or an error case | `FEATURES.md` |
| Run, seed, test, deploy | `README.md` |
| Check an endpoint's exact shape | `GET /api/v1/docs.json` |

When a fact in a doc disagrees with the code, the code is right. Fix the doc in the same change.

**Don't** start editing a module you have not read. **Don't** trust a hand-written route list over the OpenAPI spec — the spec is generated from the live router.

---

## 2. Module shape

Every module has the same files, in the same order, doing the same job.

```
<module>/
  <module>.routes.ts       # route table only
  <module>.controller.ts   # asyncHandler + ApiResponse, no business logic
  <module>.service.ts      # Prisma, throws AppError
  <module>.schema.ts       # Zod, .strict()
  <module>.types.ts        # local types
  <module>.serializer.ts   # module-specific response shapes
```

The flow is one direction:

```
routes → controller → service → Prisma
              ↓
         serializer
              ↓
         ApiResponse
```

A module folder is **domain-grouped**: it holds several routers, not one resource per folder (see the project structure in the README for the folder → route-prefix mapping). That is deliberate — dozens of one-resource folders would mean dozens of routing layers and serializer files for a surface that keeps growing inside the same domains.

**Don't** put business logic in a controller. **Don't** skip the serializer and return a raw Prisma object. **Don't** invent a new file naming scheme.

---

## 3. Adding a feature — worked example

Add `POST /products/archive/:id` that sets a product to `ARCHIVED` and returns the updated product.

First add the message keys the feature needs to `src/messages/` (`SUCCESS.PRODUCT.ARCHIVED`, `ERROR.PRODUCT.ALREADY_ARCHIVED`) — strings never go inline.

### Step 1 — Schema (`product.schema.ts`)

```ts
export const archiveProductSchema = z
  .object({
    reason: z.string().max(200).optional(),
  })
  .strict();
```

`.strict()` is not optional. Unknown fields are rejected with `VALIDATION_ERROR`.

**Don't** use bare `z.object({...})` without `.strict()` — it silently accepts unknown keys.

### Step 2 — Service (`product.service.ts`)

```ts
export const archiveProduct = async (productId: string, vendorId: string, reason?: string) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId, deletedAt: null },
  });

  if (!product) {
    throw new AppError(ERROR.PRODUCT.NOT_FOUND, 404, 'NOT_FOUND');
  }

  if (product.status === 'ARCHIVED') {
    throw new AppError(ERROR.PRODUCT.ALREADY_ARCHIVED, 409, 'ALREADY_ARCHIVED');
  }

  return prisma.product.update({
    where: { id: productId },
    data: { status: 'ARCHIVED', archivedReason: reason ?? '' },
  });
};
```

The service throws `AppError`, never formats a response, never touches `req` / `res`, and always scopes vendor-owned reads by `vendorId`.

**Don't** write `throw new Error('not found')`. **Don't** hardcode the message — pull it from `ERROR.*`. **Don't** query without `vendorId` scoping on a vendor-owned resource.

### Step 3 — Serializer (`product.serializer.ts`)

```ts
export const serializeArchivedProduct = (p: any) => ({
  productId: D.str(p?.id),
  name: D.str(p?.name),
  status: D.str(p?.status),
  archivedReason: D.str(p?.archivedReason),
  updatedAt: D.date(p?.updatedAt),
});
```

Every field passes through a `D.*` helper. If the canonical shape already exists in `src/utils/serialize.ts`, import it.

**Don't** redeclare a serializer that already lives in the canonical registry. **Don't** return raw `p.name` — a nullable column must not surface as `null`.

### Step 4 — Controller (`product.controller.ts`)

```ts
/** POST /products/archive/{id} */
export const archiveProductCtrl = asyncHandler(async (req, res) => {
  const product = await archiveProduct(
    req.params.id,
    req.user.vendorId,
    req.body.reason,
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: SUCCESS.PRODUCT.ARCHIVED,
    result: serializeArchivedProduct(product),
  });
});
```

**Don't** wrap the body in `try`/`catch` — `asyncHandler` handles it. **Don't** call `res.json()` by hand.

### Step 5 — Route (`product.routes.ts`)

```ts
router.post(
  '/archive/:id',
  authenticate,
  requireRole(ROLES.VENDOR),
  validate(archiveProductSchema),
  archiveProductCtrl,
);
```

Guards go on the route, not inside the controller body.

**Don't** check roles inside the controller. **Don't** skip `validate()` on a route that takes a body.

### Step 6 — Verify

```bash
npm run verify     # env:check + typecheck + lint + test
npm run e2e        # only when the change touches a request path
```

**Don't** report the work done before `npm run verify` passes.

---

## 4. Response envelope

Every response has exactly three top-level keys, in this order:

```json
{
  "status": true,
  "message": "Product archived successfully.",
  "result": {}
}
```

| Key | Type | Rule |
| --- | --- | --- |
| `status` | boolean | `true` or `false` only |
| `message` | string | never empty; past-tense, human-readable |
| `result` | object | never `null`, never a bare array |

```ts
return ApiResponse.success(res, {
  statusCode: 201,
  message: SUCCESS.PRODUCT.CREATED,
  result: serializeProduct(product),
});
```

A single-resource response — singles first, then objects, then arrays, and no pagination numbers:

```json
{
  "status": true,
  "message": "Product created successfully.",
  "result": {
    "productId": "prod_123",
    "name": "Shirt",
    "slug": "shirt",
    "price": 799,
    "stock": 25,
    "isActive": true,
    "categoryData": { "categoryId": "cat_1", "name": "Men" },
    "vendorData": { "vendorId": "v_1", "shopName": "Ravi Store" },
    "imageList": ["url1.jpg", "url2.jpg"],
    "reviewList": []
  }
}
```

An encrypted response (when encryption is on and the request was encrypted) bypasses the envelope: the client decrypts first and finds the normal envelope inside. See [Encryption](#15-encryption).

**Don't** add `meta`, `data`, `success`, `statusCode`, `timestamp`, or `requestId` at the top level. Request id belongs in the `X-Request-Id` header. **Don't** return `result: null`, a top-level array, or custom keys outside the envelope (`user: {}`, `product: {}`, `pagination: {}`).

**Don't:**

```ts
res.json({ success: true, data: product, meta: { requestId: req.id } });
res.status(200).json({ user });
```

---

## 5. Error response

```json
{
  "status": false,
  "message": "Product not found. Error Code (NOT_FOUND)",
  "result": {}
}
```

- The code lives **inside** the message, appended as `Error Code (CODE)`.
- `result` is always `{}` on an error.
- Build it with `ApiResponse.error()`, never by hand.

Validation failure:

```json
{
  "status": false,
  "message": "Please enter a valid email address. Error Code (VALIDATION_ERROR)",
  "result": {}
}
```

**Don't** put `errors`, `path`, or `code` inside `result`. **Don't** omit the code from `message`. **Don't** return `result: null` or leave `result` out. **Don't** leak stack traces or Prisma internals ("Prisma error at line 42"). **Don't** pass an `errors` field to `ApiResponse.error()`.

**Don't** differentiate "email exists" from "wrong password" on login — always `401 INVALID_CREDENTIALS`.

---

## 6. Pagination

Pagination numbers come **first** inside `result`, only when a list is present, in this exact order:

`totalRecord` → `totalPage` → `currentPage` → `limit` → `hasNext` → `hasPrevious` → `nextPage` → `previousPage`

Then `filterData` (object), then `xxxList` (array).

```ts
const { page, limit, skip } = getPagination(req.query);
const [rows, total] = await Promise.all([
  prisma.product.findMany({ skip, take: limit, include: { category: true, vendor: true, reviews: true } }),
  prisma.product.count(),
]);

return ApiResponse.paginated(res, {
  message: SUCCESS.PRODUCT.FETCHED,
  result: {
    filterData: {
      search: D.str(req.query.search as string),
      categoryId: D.str(req.query.categoryId as string),
      vendorId: D.str(req.query.vendorId as string),
      minPrice: D.float(Number(req.query.minPrice)),
      maxPrice: D.float(Number(req.query.maxPrice)),
    },
    ...serializeProductList(rows),
  },
  totalRecord: total,
  totalPage: Math.ceil(total / limit),
  currentPage: page,
  limit,
  hasNext: page * limit < total,
  hasPrevious: page > 1,
  nextPage: page * limit < total ? page + 1 : 0,
  previousPage: page > 1 ? page - 1 : 0,
});
```

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
    "filterData": { "search": "shirt", "categoryId": "", "vendorId": "", "minPrice": 0, "maxPrice": 0 },
    "productList": []
  }
}
```

`serializeXList()` returns only the `xxxList`; the pagination numbers are added by `ApiResponse.paginated()`.

**Don't** put pagination numbers outside `result`, or wrap them in `meta`. **Don't** place `xxxList` before the numbers, or the numbers in the wrong order. **Don't** send `totalRecord` / `totalPage` on a single-resource response. **Don't** paginate a nested list inside a single parent (`subOrderList` on one order gets none). **Don't** build the block manually with `Math.min` / `Math.max` — let `ApiResponse.paginated()` and `getPagination()` do it. **Don't** put pagination numbers in `serializeXList()`.

---

## 7. No-null policy

A nullable column must never surface as `null`. Every field passes through a `D.*` helper:

| Type | Default |
| --- | --- |
| string | `""` |
| int | `0` |
| float | `0.0` |
| boolean | `false` |
| array | `[]` |
| object | `{}` |
| date | `""` |

Defaults apply recursively to nested objects. An empty relation is `{}`, an empty list is `[]` — never `null`. Prisma `null` is replaced with the default in the serializer.

```ts
productId: D.str(p?.id),
price:     D.float(p?.price),
stock:     D.num(p?.stock),
isActive:  D.bool(p?.status === 'ACTIVE'),
imageList: D.arr(p?.images),
vendorData: p?.vendor ? { vendorId: D.str(p.vendor.id) } : {},
```

The database (Prisma level) may hold `null`; the serializer scrubs it.

**Don't** send `"phone": null`, `"price": null`, `"rating": null`, `"isActive": null`, `"items": null`, `"userData": null`, `"site.logo": null`, or `"site.supportPhones": null`.

**Don't** skip the `D.*` helper and write `?? ''` inline — inconsistent across modules.

---

## 8. Key ordering inside every object

```
1st → pagination numbers (only if this object holds a list)
2nd → single values      (string, number, boolean, date)
3rd → objects            (xxxData)
4th → arrays             (xxxList)
```

```json
{
  "userId": "u_1",
  "fullName": "Ravi",
  "age": 28,
  "isActive": true,
  "userData": { "email": "ravi@x.com" },
  "addressData": { "city": "Delhi" },
  "rolesList": ["admin", "customer"],
  "orderList": [{ "orderId": "o_1" }]
}
```

Suffix contract the client depends on:

| Suffix | Meaning | Example |
| --- | --- | --- |
| `xxxData` | nested object | `userData`, `orderData` |
| `xxxList` | array | `productList`, `rolesList` |
| no suffix | single value | `productId`, `price`, `isActive` |

One line, one key — keep the JSON readable.

**Don't** place an array before a single value. **Don't** place an object before a single value. **Don't** place pagination numbers after singles, objects or arrays. **Don't** mix the order randomly. **Don't** put single values inside `xxxData`. **Don't** put an object inside `xxxList` where an array of objects is expected.

**Wrong:**

```json
{
  "rolesList": ["admin"],   // ❌ array before singles
  "userId": "u_1",          // ❌ single after array
  "phone": null             // ❌ null never allowed
}
```

---

## 9. Endpoint naming

| Case | Style | Example |
| --- | --- | --- |
| Pure CRUD resource | REST | `GET /products`, `DELETE /products/:id` |
| Action / self-op | camelCase verb-noun | `updateProfile`, `cancelOrder`, `getAll`, `getById/:id` |
| Multi-mode one URL | `POST /<module>/<action>` + `body.type` | `/auth/register` with `type: CUSTOMER \| VENDOR`; `/auth/sendOtp` with `type: REGISTER \| FORGOT_PASSWORD \| LOGIN \| PHONE_VERIFY \| EMAIL_VERIFY \| TWO_FA` |
| Multi-word module | camelCase | `/flashSales`, `/giftCards`, `/auditLogs`, `/apiKeys`, `/deliveryBoys` |

Prefix is `/api/v1/...`. Query params: `?page=1&limit=20&sort=-createdAt&search=x&status=active`. Sub-resource: `/orders/:id/items`.

The live router (listed in Part E of `FEATURES.md`) is mostly verb-noun already — for example `/products/getAll`, `/products/createProduct`, `/products/deleteProduct/:id`. When you add a route to an existing module, match that module's style.

**Don't** use `/getProducts`, singular `/product`, `/products/getAll` for a pure CRUD resource you are adding, `/products/delete/123`, PascalCase (`/api/v1/Products`), snake_case (`/vendor_profiles`), kebab-case (`/vendor-profiles`), `/auth/forgot-password` (use `/auth/forgotPassword`), `/auth/reset-password`, `/auth/refresh` (use `/auth/refreshToken`), `/users/me` (use `/users/getProfile` + `/users/updateProfile`), `/vendors/apply` (registration handles it with `type: VENDOR`), or multiple URLs for one intent (`/register-customer`, `/register-vendor`, `/register-admin`). **Don't** mix query casing (`Search` vs `search`).

---

## 10. Constants, messages, config

Rule: **no hardcoded string, message or number anywhere.** Everything comes from one place.

| Layer | Where | When |
| --- | --- | --- |
| Static | `src/constants/` | roles, enums, statuses, HTTP codes |
| Static | `src/messages/` | success, error, validation text |
| Static | `src/config/` | app defaults, TTLs, limits |
| Dynamic | `SystemSetting` (DB + Redis) | anything an admin changes at runtime |

```ts
// right
throw new AppError(ERROR.PRODUCT.NOT_FOUND, 404, 'NOT_FOUND');
```

Runtime-togglable behaviour (`loyalty.enabled`, `vendor.autoApprove`, `payment.cod.enabled`) is read at call time via `getSetting()`. The static config values and every `SystemSetting` default are listed in Part C of `FEATURES.md`; excerpts of the constants and message files are in the appendices below.

**Dynamic settings model**

```prisma
model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  category  String
  isPublic  Boolean  @default(false)
  updatedAt DateTime @updatedAt
  updatedBy String?
  @@index([category])
}
```

`settings.service.ts` caches in Redis (TTL 5 min) and invalidates on an admin update:

```ts
export const getSetting = async <T>(key: string, fallback: T): Promise<T> => {
  const cached = await redis.get(`setting:${key}`);
  if (cached) return JSON.parse(cached) as T;
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const val = (row?.value as T) ?? fallback;
  await redis.set(`setting:${key}`, JSON.stringify(val), 'EX', 300);
  return val;
};

export const setSetting = async (key: string, value: any, category: string, userId?: string) => {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, category, updatedBy: userId },
    update: { value, updatedBy: userId },
  });
  await redis.del(`setting:${key}`);
};
```

**Where each kind of value lives.** Legend: 🟢 static (code) — rarely changes · 🔵 DB + Redis (dynamic) — an admin can change it at runtime · 🟡 hybrid — code default + DB override.

| # | Item | Type | Stored in | Purpose |
| --- | --- | --- | --- | --- |
| 1 | Constants | 🟢 | `src/constants/` | roles, enums, HTTP codes |
| 2 | Config | 🟡 | `src/config/` + DB overrides | app-level defaults |
| 3 | Environment variables | 🟢 | `.env` + Zod validation | secrets, DB URL, keys |
| 4 | API response messages | 🟡 | `src/messages/` + DB | success/error text |
| 5 | Error messages | 🟡 | `src/messages/error.ts` + DB | standard errors |
| 6 | Success messages | 🟡 | `src/messages/success.ts` + DB | standard success |
| 7 | Validation rules | 🟡 | `src/config/validation` + DB | length, regex, ranges |
| 8 | Business rules | 🔵 | DB `SystemSetting` | commission %, minimum order, etc. |
| 9 | Status codes / values | 🟢 | `src/constants/statuses.ts` | `ORDER_STATUS`, `VENDOR_STATUS` |
| 10 | Roles | 🟢 | `src/constants/roles.ts` | fixed roles |
| 11 | Permissions | 🔵 | DB `RolePermission` | role → allowed actions |
| 12 | Feature flags | 🔵 | DB `SystemSetting` (category=feature) | ON/OFF features |
| 13 | Pagination settings | 🟡 | `src/config/pagination.config.ts` | default page/limit |
| 14 | File upload settings | 🟡 | `src/config/upload.config.ts` | temp path, folder |
| 15 | Image / video size limits | 🔵 | DB (admin change) | 5 MB → 10 MB at runtime |
| 16 | Allowed file types | 🔵 | DB | MIME list |
| 17 | OTP configuration | 🔵 | DB | length, expiry, max retries |
| 18 | Password rules | 🟡 | `src/config/password.config.ts` + DB | min length, regex |
| 19 | Login attempt limits | 🔵 | DB + Redis counter | 5 attempts → lock 15 min |
| 20 | Token / JWT configuration | 🟢 | `.env` + `jwt.config.ts` | expiry, secrets |
| 21 | Session configuration | 🔵 | DB + Redis | timeout, max devices |
| 22 | Email configuration | 🟢 | `.env` | SMTP host, credentials |
| 23 | SMS configuration | 🟢 | `.env` | provider credentials |
| 24 | Notification templates | 🔵 | DB `NotificationTemplate` | subject, body, variables |
| 25 | Push notification config | 🟢 | `.env` | FCM key |
| 26 | Payment configuration | 🔵 | DB | COD/UPI/Bank on/off, bank details |
| 27 | Payment limits | 🔵 | DB | min/max per method |
| 28 | Transaction limits | 🔵 | DB | per day, per user |
| 29 | Transaction fees / charges | 🔵 | DB | platform fee, COD fee |
| 30 | Currency configuration | 🔵 | DB | INR symbol, decimals |
| 31 | Country configuration | 🔵 | DB | allowed countries |
| 32 | Phone country codes | 🟢 | `src/constants/countries.ts` | static ISO list |
| 33 | Language / localisation | 🔵 | DB `Translation` table | key → value per locale |
| 34 | Date & time format | 🔵 | DB | display format |
| 35 | Timezone | 🔵 | DB | e.g. `Asia/Kolkata` |
| 36 | Third-party API config | 🟢 | `.env` | Razorpay, Cloudinary keys |
| 37 | Database configuration | 🟢 | `.env` | `DATABASE_URL` |
| 38 | Cache configuration | 🟢 | `.env` + `cache.config.ts` | TTLs |
| 39 | Rate limiting | 🟡 | `rateLimit.config.ts` + DB | per-route limits |
| 40 | Security configuration | 🟡 | `.env` + DB | encryption ON/OFF, headers |
| 41 | CORS configuration | 🟢 | `.env` `CORS_ORIGINS` | whitelist |
| 42 | Maintenance mode | 🔵 | DB | ON → API returns 503 |
| 43 | App version / force update | 🔵 | DB (per platform) | Android/iOS update prompt |
| 44 | Feature enable / disable | 🔵 | DB | same as #12 |
| 45 | Admin settings | 🔵 | DB | admin preferences |
| 46 | Dynamic dropdown data | 🔵 | DB `Dropdown` table | type → options[] |
| 47 | Dynamic categories | 🔵 | DB `Category` table | already dynamic |
| 48 | Dynamic labels / text | 🔵 | DB `Translation` | UI labels |
| 49 | Dynamic email templates | 🔵 | DB `EmailTemplate` | HTML with variables |
| 50 | Dynamic SMS templates | 🔵 | DB `SmsTemplate` | text with variables |
| 51 | Dynamic notification templates | 🔵 | DB `NotificationTemplate` | title, body, variables |
| 52 | Dynamic business settings | 🔵 | DB | commission, minimum order, etc. |
| 53 | System settings in DB | 🔵 | `SystemSetting` table | generic key-value |
| 54 | Audit / activity config | 🟡 | DB | which actions get logged |
| 55 | Logging configuration | 🟢 | `logger.config.ts` + `.env` | level, transport |

**Golden rule.** No magic string or number in code — import from `constants/`, `messages/` or `config/`. Anything that changes at runtime is a DB `SystemSetting` (Redis-cached). The admin panel goes Settings page → `/settings/updateSetting` → DB update → Redis invalidated. Frontends fetch public settings (site name, logo, currency, feature flags) from `/settings/getPublicSettings` instead of hardcoding them.

**Don't** write `throw new AppError('Product not found.', 404, 'NOT_FOUND')`. **Don't** embed magic numbers. **Don't** cache `getSetting()` in a module-level constant.

---

## 11. Helper classes

| Helper | Job |
| --- | --- |
| `D.str` / `D.num` / `D.float` / `D.bool` / `D.arr` / `D.obj` / `D.date` | per-field default |
| `ApiResponse.success()` | single resource |
| `ApiResponse.paginated()` | list, pagination numbers first |
| `ApiResponse.error()` | error, code inside message, `result: {}` |
| `AppError` | thrown from the service layer; `errorHandler` catches it |
| `asyncHandler(fn)` | removes try/catch from controllers |
| `serializeX()` | every entity, one shape, one file |
| `getPagination(query)` | page / limit / skip |

`src/utils/defaults.ts`

```ts
export const D = {
  str:   (v?: string  | null) => v ?? '',
  num:   (v?: number  | null) => v ?? 0,
  float: (v?: number  | null) => v ?? 0.0,
  bool:  (v?: boolean | null) => v ?? false,
  arr:   <T>(v?: T[] | null): T[] => (Array.isArray(v) ? v : []),
  obj:   <T extends object>(v?: T | null): T => v ?? ({} as T),
  date:  (v?: Date | string | null) =>
    v ? new Date(v).toISOString() : '',
};
```

`src/utils/ApiResponse.ts`

```ts
import { Response } from 'express';
import { D } from './defaults';

export class ApiResponse {
  static success(
    res: Response,
    {
      statusCode = 200,
      message = 'OK',
      result = {},
    }: { statusCode?: number; message: string; result?: any },
  ) {
    return res.status(statusCode).json({
      status: true,
      message: D.str(message),
      result: result ?? {},
    });
  }

  static paginated(
    res: Response,
    {
      statusCode = 200,
      message = 'OK',
      result = {},
      totalRecord = 0,
      totalPage = 0,
      currentPage = 0,
      limit = 0,
      hasNext = false,
      hasPrevious = false,
      nextPage = 0,
      previousPage = 0,
    }: {
      statusCode?: number;
      message: string;
      result?: any;
      totalRecord?: number;
      totalPage?: number;
      currentPage?: number;
      limit?: number;
      hasNext?: boolean;
      hasPrevious?: boolean;
      nextPage?: number;
      previousPage?: number;
    },
  ) {
    return res.status(statusCode).json({
      status: true,
      message: D.str(message),
      result: {
        totalRecord: D.num(totalRecord),
        totalPage: D.num(totalPage),
        currentPage: D.num(currentPage),
        limit: D.num(limit),
        hasNext: D.bool(hasNext),
        hasPrevious: D.bool(hasPrevious),
        nextPage: D.num(nextPage),
        previousPage: D.num(previousPage),
        ...(result ?? {}),
      },
    });
  }

  static error(
    res: Response,
    {
      statusCode = 500,
      message = 'Something went wrong.',
      code = 'INTERNAL_ERROR',
    }: { statusCode?: number; message: string; code?: string },
  ) {
    return res.status(statusCode).json({
      status: false,
      message: `${D.str(message)} Error Code (${D.str(code)})`,
      result: {},
    });
  }
}
```

`src/utils/AppError.ts`

```ts
export class AppError extends Error {
  statusCode: number;
  code: string;
  errors: any[];

  constructor(
    message: string,
    statusCode = 500,
    code = '',
    errors: any[] = [],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

`src/utils/pagination.ts`

```ts
import { PAGINATION } from '../config/pagination.config';

export const getPagination = (query: any) => {
  const page  = Math.max(1, Number(query.page)  || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, Number(query.limit) || PAGINATION.DEFAULT_LIMIT),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
```

`src/utils/asyncHandler.ts`

```ts
import { RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

`src/middlewares/error.ts`

```ts
import { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return ApiResponse.error(res, {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
    });
  }

  if (err?.code === 'P2002') {
    return ApiResponse.error(res, {
      statusCode: 409, message: ERROR.COMMON.DUPLICATE, code: 'DUPLICATE',
    });
  }
  if (err?.code === 'P2025') {
    return ApiResponse.error(res, {
      statusCode: 404, message: ERROR.COMMON.NOT_FOUND, code: 'NOT_FOUND',
    });
  }

  return ApiResponse.error(res, {
    statusCode: 500,
    message: ERROR.COMMON.SERVER_ERROR,
    code: 'INTERNAL_ERROR',
  });
};
```

**Don't** skip `D.*` for inline `?? ''` / `?? 0`. **Don't** hand-build pagination with `Math.min` / `Math.max`. **Don't** call `res.json()` directly. **Don't** use `try`/`catch` in a controller.

---

## 12. Serializers

There is **one registry** of entity serializers: `src/utils/serialize.ts`. An entity's shape must never be defined in two places, or the same record would reach clients in two different JSON shapes. A module's `<module>.serializer.ts` builds only that module's own response shapes (`serializeProfile`, `serializeUserList`, `serializeCategoryTree`, `serializeEstimate`) and imports the canonical entity serializers — it never re-declares them. A smaller nested projection gets its own name (`serializeUserSummary` — review author, activity-log actor, nested `userData`) so nobody has to guess which user shape an endpoint returns. `serializer-registry.test.ts` (part of `npm test`) fails if a module re-declares a canonical name.

Pattern (`src/utils/serialize.ts`):

```ts
import { D } from './defaults';

export const serializeProduct = (p: any) => ({
  productId: D.str(p?.id),
  name: D.str(p?.name),
  slug: D.str(p?.slug),
  price: D.float(p?.price),
  stock: D.num(p?.stock),
  isActive: D.bool(p?.status === 'ACTIVE'),
  createdAt: D.date(p?.createdAt),

  categoryData: p?.category
    ? { categoryId: D.str(p.category.id), name: D.str(p.category.name) }
    : {},
  vendorData: p?.vendor
    ? { vendorId: D.str(p.vendor.id), shopName: D.str(p.vendor.shopName) }
    : {},

  imageList: D.arr(p?.images),
  reviewList: D.arr(p?.reviews).map((r: any) => ({
    reviewId: D.str(r.id),
    rating: D.num(r.rating),
    comment: D.str(r.comment),
  })),
});

export const serializeProductList = (rows: any[]) => ({
  productList: D.arr(rows).map(serializeProduct),
});
```

**Don't** return a raw Prisma object (`res.json(prismaResult)`). **Don't** skip `serializeX()`. **Don't** define one entity's `serializeX()` in two places. **Don't** leak `passwordHash`, `internalId` or `deletedAt` unless needed.

---

## 13. Comments

Comments are in **English**, and they explain **why**, never **what**. Hinglish is acceptable only in documentation and commit messages — never in source code. The four forms each have one job; do not mix them.

**1. Route marker** — one line, method and path only, above every route handler:

```ts
/** POST /auth/register */
```

**2. Doc block** — two or more lines: a one-line summary, a blank ` *` line, then the non-obvious why. This is the form for anything longer than one line:

```ts
/**
 * Issues a refresh token and stores its hash, not the token itself.
 *
 * The raw token only exists in the response and the client's cookie jar. A
 * stolen database dump cannot be replayed against the refresh endpoint.
 */
```

**3. Inline note** — one line, `//`, only where the code cannot say it itself and one extra word helps the reader:

```ts
// Runs before the insert, so no unverified account is ever created.
```

**4. Banner** — a section divider: drawing characters and a label, never prose:

```ts
// ── Orders ────────────────────────────────────────────
```

Rules:

- **"Why", not "what".** Instead of `// increment counter`, write `// Attempts are capped here rather than in the service so a direct call cannot bypass the cap.`
- **One line means one `//`.** If it takes two lines it is a doc block — two `//` lines in a row lose the meaning of the form. `npm run comments:check` enforces this.
- **Do not add a comment when you fix something.** The fix makes working code; a new comment on it has no reason to exist. Comment only when the fix introduces an invariant the code cannot express (for example an ordering guarantee that comes from `Promise.all`). Comments that were already there stay.
- **Do not narrate history** ("previously this was X", "now it does Y", "this stops Z from happening"). That documents the change, not the current behaviour, and goes stale fast. Write the rule that is still true and drop the rest. `comments:check` catches narrative wording too.
- **A stale comment is deleted, not updated.**
- **Comment only where the code cannot speak for itself** — a licence header, the reason for a `@ts-ignore`, what a quirky regex does.
- **`TODO`** needs an owner, a reason and a removal condition — otherwise it is not a TODO.
- ESLint directive comments have their own format; leave them alone.

The top of a file gets a 2–4 line doc block saying what the file is for. Every exported function, class and const gets JSDoc; so do interfaces and `type`s — why the shape is what it is belongs to the contract. In config and constant files do not comment every value — the value documents itself; if needed, one block at the top covers the defaults together.

`npm run comments:check` finds three mistakes: a run of two or more `//` lines where a doc block belongs, an empty doc block, and narrative wording. `npm run comments:fix` repairs the first automatically (it rewrites multi-line `//` prose into doc blocks). Run `comments:check` before committing.

**Don't** write `// increment counter`. **Don't** stack two or more `//` lines. **Don't** narrate history. **Don't** add a comment as part of a fix unless the fix introduces an invariant the code cannot express. **Don't** write `TODO` without an owner, a reason, and a removal condition.

---

## 14. Security

**Do:**

- Access token in the response body, refresh token in an HttpOnly cookie.
- Check `isEmailVerified` / `isPhoneVerified` before issuing a session (at least one must be `true`); else `403 ACCOUNT_UNVERIFIED`.
- Check a blocked device on every request.
- Keep the password hash out of serializers entirely — never select it.
- Let the env schema refuse `OTP_STATIC_CODE` in production.
- Key an OTP to the identifier it was sent to.

**Don't:**

- Put `null` in a JWT payload.
- Store the refresh token in localStorage.
- Use CORS with credentials and wildcard (`*` + `credentials: true`).
- Put the access token in a cookie as well as the body.
- Give a session to an unverified account.
- Send `verifyEmail` / `verifyPhone` for an identifier that is not the account's own.
- Let an OTP be consumed for an identifier it was not issued to.
- Return the error stack in a production response.
- Ignore a blocked device.

---

## 15. Encryption

**Do:**

- Skip paths: `/health`, `/docs`, `/docs.json`, `/webhooks`, `/track`.
- Read the `x-encrypted: 1` header and decrypt the body when `ENCRYPTION.ENABLED`.
- Leave binary uploads alone.
- Document both modes (plain and encrypted) in Swagger.

**Don't** encrypt the skip paths. **Don't** encrypt file uploads. **Don't** honour the header when encryption is off — ignore it. The algorithm, flow and middleware are described in Part B of `FEATURES.md`.

---

## 16. Tracking and analytics

**Do:**

- Carry `sessionId` and `deviceId` on every event.
- Geo-lookup via `geoip-lite`, respecting `X-Forwarded-For`.
- Filter bots with `ua-parser-js` (`isBot` flag).
- Use Redis counters for realtime; a BullMQ nightly job for rollups.
- Stream exports (pagination or cursor).

**Don't** write a heavy synchronous DB row per event — use a queue or stream. **Don't** count bots as real users. **Don't** leave geo as `null` — send `{}`. **Don't** run repeated heavy SQL for a realtime dashboard. **Don't** keep raw events forever — set retention.

---

## 17. Chat, socket, wallet

**Do:**

- Verify the JWT at the socket handshake.
- Deliver by room, not broadcast.
- Persist messages to the DB.
- Wrap wallet changes in a Prisma transaction.
- Refuse negative balances.
- Link a redemption to an order.

**Don't** skip socket auth. **Don't** broadcast to every connected client. **Don't** keep a message only in memory. **Don't** allow a negative balance. **Don't** skip transaction atomicity. **Don't** redeem without an order link.

---

## 18. Config defaults and seeding

**Do:**

- Give every config file (app, pagination, jwt, password, otp, rateLimit, upload, tracking, analytics, socket, pdf) hard-coded defaults.
- Seed every `SystemSetting` key with its default and an `isPublic` flag.
- Use `upsert` in the seed so existing values are never overridden.
- Keep `site.supportPhones` an array (`[]` or 3–4 numbers) — never a string.

**Don't** use `create` in the seed — use `upsert` (idempotent). **Don't** hard-code public keys in the admin panel — respect the `isPublic` flag.

---

## 19. Testing and hygiene

**Do:**

- Snapshot tests for response shape.
- `vitest` + `supertest` — auth and orders at minimum.
- ESLint + Prettier + Husky pre-commit.
- Validate env at boot (Zod) — crash early on a missing variable.
- Graceful shutdown — on SIGTERM: Prisma disconnect, Redis quit, Socket close.

---

## 20. Migrations

`prisma/migrations/20260101000000_init` holds the full schema. Every later change gets its own dated folder.

The rule: while a folder has never run against any database, you may edit it in place. Once a folder appears in `_prisma_migrations` with a `finished_at`, add a new dated folder — `migrate deploy` picks migrations by name and skips anything already applied, so an in-place edit becomes a silent no-op.

The test is **not** whether the database holds real data. It is whether `_prisma_migrations` lists the folder.

```bash
# correct
npx prisma migrate dev --name add_product_archived_reason
```

`prisma migrate dev` needs a concurrent shadow database, so it does not work against the local PGlite server — use `npm run db:migrate` locally and `npx prisma migrate deploy` in CI and production.

**Don't** edit an applied migration folder. **Don't** run `prisma migrate reset` on a shared database. **Don't** `db push` on a database you intend to `migrate deploy` later without understanding that it records nothing.

---

## 21. Commands

The README is the authoritative command reference. The ones you need in the inner loop:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with hot reload |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm test` | Unit + contract tests, no database needed |
| `npm run e2e` | Live HTTP suites, needs a real database |
| `npm run env:check` / `env:sync` | Fail if `.env` and `.env.example` drifted / regenerate `.env.example` |
| `npm run comments:check` / `comments:fix` | Fail if a comment breaks the structure / auto-fix |
| `npm run seed` | Idempotent seed — settings, RBAC, SUPER_ADMIN, demo data |
| `npm run db:reset` | Drop, recreate, migrate, seed — **dev only** |
| `npm run verify` | **The gate:** env:check + typecheck + lint + test |

**Do:**

- Run `npm run verify` before calling anything done.
- Run `npm run e2e` yourself when the change touches a request path.
- Use `npm run db:reset` only in development. It refuses a remote or production host on purpose.
- Use `npm ci --include=dev` in a production build — `NODE_ENV=production` drops devDependencies, and `prisma` / `typescript` / `tsx` live there.

**Don't:**

- Commit or push unless asked.
- Amend a pushed commit.
- Add `--ignore-scripts` to a production install — bcrypt fetches its native binary in an install script.
- Claim a check you did not run.
- Run `prisma migrate reset` on a database you care about.
- Rely on `format:check` as a CI gate — formatting is enforced per-commit by `lint-staged`, not in CI.

---

## 22. Edge cases

The full catalogue of edge cases — cases, behaviours, status codes and error code strings for auth, product, cart/order, payment, review, chat/ticket, tracking, device/session, upload, rate limit, maintenance, encryption, DB/Prisma, CORS, validation and i18n — is Part D of `FEATURES.md`. Rules with their own codes (idempotency, bans, segments, failed jobs, vacation, …) are in Part B of the same file.

Prisma errors are already mapped in `src/middlewares/error.ts`: `P2002` (unique) → `409 DUPLICATE`, `P2025` (not found) → `404 NOT_FOUND`, a failed transaction → rollback, log, `500 INTERNAL_ERROR`. Do not re-map them in a service.

---

## 23. HTTP status codes

| Code | When | Code string |
| --- | --- | --- |
| 200 | GET, PUT, PATCH success | — |
| 201 | POST created | — |
| 204 | DELETE with no body | — |
| 400 | Validation / bad request | `VALIDATION_ERROR` |
| 401 | Not logged in, bad token | `UNAUTHORIZED`, `TOKEN_EXPIRED` |
| 403 | Logged in, no permission | `FORBIDDEN` |
| 404 | Not found | `NOT_FOUND` |
| 409 | Conflict, duplicate | `EMAIL_EXISTS`, `STOCK_CHANGED` |
| 413 | Payload too large | `PAYLOAD_TOO_LARGE` |
| 415 | Wrong media type | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | Business rule violation | `OUT_OF_STOCK`, `COUPON_EXPIRED` |
| 429 | Rate limited | `RATE_LIMITED` |
| 500 | Server error | `INTERNAL_ERROR` |
| 503 | Maintenance | `MAINTENANCE` |

---

## 24. Pre-push checklist

- [ ] Controller has no business logic.
- [ ] Service throws `AppError`, not raw `Error`.
- [ ] Every response goes through `ApiResponse.success` / `.paginated` / `.error`.
- [ ] Serializer is called; no raw Prisma object reaches the client.
- [ ] Every field passes through a `D.*` helper — no `null`.
- [ ] Key order inside every object: numbers, singles, objects, arrays.
- [ ] Pagination numbers only on list endpoints, inside `result`, first.
- [ ] No hardcoded strings or numbers — pulled from `constants/`, `messages/`, `config/`, or `SystemSetting`.
- [ ] Routes guarded per route, not inside the controller.
- [ ] Comments explain why, not what. No `//` runs. No narrative.
- [ ] Zod schema uses `.strict()`.
- [ ] Runtime-toggleable behaviour reads a setting at call time.
- [ ] Migration added as a new dated folder if the schema changed.
- [ ] `FEATURES.md` / `README.md` updated in the same change if behaviour, endpoints, env vars or commands changed.
- [ ] `npm run verify` passes.
- [ ] If a request path changed, `npm run e2e` passes.

---

## 25. Working method

1. Read the module end to end before editing.
2. Match the surrounding style. Consistency is the point.
3. Change code and the doc that describes it in the same commit, or the doc is already stale.
4. If a doc and the code disagree, the code is right. Fix the doc and say so.
5. Run `npm run verify`. Run `npm run e2e` if the change touches a request path.
6. Report what you changed and what you verified.

Do not commit or push unless asked. Do not amend a pushed commit.

---

## Appendix A — Constants excerpt

Illustrative excerpts of `src/constants/`; the files in the repo are the source of truth. `TRACKING_EVENT` holds the same event names as `TRACKING.ALLOWED_EVENTS` (`FEATURES.md`, Part C).

```ts
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SUB_ADMIN: 'SUB_ADMIN',
  VENDOR: 'VENDOR',
  CUSTOMER: 'CUSTOMER',
  DELIVERY_BOY: 'DELIVERY_BOY',
} as const;
export type Role = keyof typeof ROLES;

export const REGISTER_TYPE = { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR' } as const;
export type RegisterType = keyof typeof REGISTER_TYPE;

export const OTP_TYPE = {
  REGISTER: 'REGISTER',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
  LOGIN: 'LOGIN',
  PHONE_VERIFY: 'PHONE_VERIFY',
  EMAIL_VERIFY: 'EMAIL_VERIFY',
  TWO_FA: 'TWO_FA',
} as const;
export type OtpType = keyof typeof OTP_TYPE;

export const SOCIAL_PROVIDER = { GOOGLE: 'GOOGLE', APPLE: 'APPLE', FACEBOOK: 'FACEBOOK' } as const;

export const PLATFORM = { ANDROID: 'ANDROID', IOS: 'IOS', WEB: 'WEB' } as const;

export const PAYMENT_METHOD = {
  COD: 'COD', UPI: 'UPI', BANK: 'BANK', CARD: 'CARD',
  NETBANKING: 'NETBANKING', WALLET: 'WALLET', RAZORPAY: 'RAZORPAY', STRIPE: 'STRIPE',
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PENDING_TOKEN: 'PENDING_TOKEN',
  CONFIRMED: 'CONFIRMED',
  SHIPPED: 'SHIPPED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURNED: 'RETURNED',
} as const;

export const RETURN_STATUS = {
  REQUESTED: 'REQUESTED', APPROVED: 'APPROVED', REJECTED: 'REJECTED',
  PICKED_UP: 'PICKED_UP', RECEIVED: 'RECEIVED', REFUNDED: 'REFUNDED',
} as const;

export const TICKET_STATUS = {
  OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'RESOLVED', CLOSED: 'CLOSED',
} as const;

export const TRACKING_EVENT = {
  APP_OPEN: 'app_open',
  APP_INSTALL: 'app_install',
  LOGIN: 'login',
  PRODUCT_VIEW: 'product_view',
  ADD_TO_CART: 'add_to_cart',
  ORDER_PLACED: 'order_placed',
  // …one entry per name in TRACKING.ALLOWED_EVENTS
} as const;

export const NOTIFICATION_CHANNEL = {
  EMAIL: 'EMAIL', SMS: 'SMS', PUSH: 'PUSH', WHATSAPP: 'WHATSAPP', IN_APP: 'IN_APP',
} as const;
```

---

## Appendix B — Message catalogue excerpt

Illustrative excerpts of `src/messages/`. Add new keys here and in the repo before using them.

`src/messages/success.ts`

```ts
export const SUCCESS = {
  AUTH: {
    REGISTERED_CUSTOMER: 'Customer registered successfully.',
    REGISTERED_VENDOR: 'Vendor registered successfully.',
    LOGGED_IN: 'Logged in successfully.',
    LOGGED_OUT: 'Logged out successfully.',
    TOKEN_REFRESHED: 'Token refreshed.',
    OTP_SENT: 'OTP sent successfully.',
    OTP_VERIFIED: 'OTP verified successfully.',
    PASSWORD_RESET: 'Password reset successfully.',
    PROFILE_UPDATED: 'Profile updated successfully.',
    PASSWORD_UPDATED: 'Password updated successfully.',
    SOCIAL_LINKED: 'Social account linked successfully.',
    SOCIAL_UNLINKED: 'Social account unlinked.',
    SESSION_REVOKED: 'Session revoked.',
    TWO_FA_ENABLED: 'Two-factor authentication enabled.',
    TWO_FA_DISABLED: 'Two-factor authentication disabled.',
  },
  PRODUCT: {
    CREATED: 'Product created successfully.',
    UPDATED: 'Product updated successfully.',
    DELETED: 'Product deleted successfully.',
    BULK_UPDATED: 'Products bulk updated successfully.',
    IMAGES_UPLOADED: 'Images uploaded successfully.',
    STOCK_UPDATED: 'Stock updated successfully.',
  },
  ORDER: {
    PLACED: 'Order placed successfully.',
    CANCELLED: 'Order cancelled.',
    STATUS_UPDATED: 'Order status updated.',
    REORDERED: 'Order re-created successfully.',
    TRACKED: 'Order tracking fetched.',
  },
  CART: {
    ITEM_ADDED: 'Item added to cart.',
    ITEM_UPDATED: 'Cart updated.',
    ITEM_REMOVED: 'Item removed.',
    CART_CLEARED: 'Cart cleared.',
    COUPON_APPLIED: 'Coupon applied.',
    COUPON_REMOVED: 'Coupon removed.',
  },
  WISHLIST: {
    ADDED: 'Added to wishlist.',
    REMOVED: 'Removed from wishlist.',
    CLEARED: 'Wishlist cleared.',
    MOVED_TO_CART: 'Moved to cart.',
  },
  PAYMENT: {
    TOKEN_PAID: 'Token payment recorded.',
    BALANCE_PAID: 'Balance payment recorded.',
    VERIFIED: 'Payment verified.',
    REFUND_INITIATED: 'Refund initiated.',
  },
  PAYOUT: {
    REQUESTED: 'Payout requested.',
    APPROVED: 'Payout approved.',
    REJECTED: 'Payout rejected.',
    GENERATED: 'Payout cycle generated.',
  },
  REVIEW: {
    ADDED: 'Review added.',
    UPDATED: 'Review updated.',
    DELETED: 'Review deleted.',
    APPROVED: 'Review approved.',
    REJECTED: 'Review rejected.',
    REPLIED: 'Reply posted.',
  },
  RETURN: {
    REQUESTED: 'Return requested.',
    APPROVED: 'Return approved.',
    REJECTED: 'Return rejected.',
    PICKED_UP: 'Return picked up.',
    RECEIVED: 'Return received.',
    REFUNDED: 'Refund processed.',
  },
  TICKET: {
    CREATED: 'Ticket created.',
    REPLIED: 'Reply sent.',
    UPDATED: 'Ticket updated.',
    CLOSED: 'Ticket closed.',
  },
  CHAT: {
    STARTED: 'Conversation started.',
    MESSAGE_SENT: 'Message sent.',
    READ: 'Marked as read.',
  },
  NOTIFICATION: {
    FETCHED: 'Notifications fetched.',
    MARKED_READ: 'Marked as read.',
    DEVICE_REGISTERED: 'Device registered.',
    PREFERENCES_UPDATED: 'Preferences updated.',
    BULK_SENT: 'Notification blast sent.',
  },
  WALLET: {
    BALANCE_FETCHED: 'Wallet balance fetched.',
    ADDED: 'Money added to wallet.',
    DEBITED: 'Wallet debited.',
  },
  COUPON: {
    CREATED: 'Coupon created.',
    UPDATED: 'Coupon updated.',
    DELETED: 'Coupon deleted.',
    VALIDATED: 'Coupon is valid.',
  },
  SETTING: {
    UPDATED: 'Setting updated.',
    BULK_UPDATED: 'Settings bulk updated.',
    RESET: 'Settings reset to default.',
  },
  COMMON: {
    CREATED: 'Created successfully.',
    UPDATED: 'Updated successfully.',
    DELETED: 'Deleted successfully.',
    FETCHED: 'Fetched successfully.',
  },
};
```

`src/messages/error.ts`

```ts
export const ERROR = {
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password.',
    UNAUTHORIZED: 'You are not authorized.',
    TOKEN_EXPIRED: 'Session expired, please log in again.',
    EMAIL_EXISTS: 'Email is already registered.',
    PHONE_EXISTS: 'Phone number is already registered.',
    INVALID_REGISTER_TYPE: 'Invalid register type.',
    VENDOR_DETAILS_REQUIRED: 'Vendor shop details required.',
    INVALID_OTP_TYPE: 'Invalid OTP type.',
    OTP_INVALID: 'Invalid or expired OTP.',
    OTP_MAX_ATTEMPTS: 'Maximum OTP attempts reached.',
    OTP_RESEND_COOLDOWN: 'Please wait before requesting another OTP.',
    ACCOUNT_SUSPENDED: 'Your account is suspended.',
    SESSION_EXPIRED: 'Session expired, please log in again.',
    SOCIAL_PROVIDER_INVALID: 'Social provider not supported.',
    TWO_FA_REQUIRED: '2FA verification required.',
    TWO_FA_INVALID: 'Invalid 2FA code.',
  },
  PRODUCT: {
    NOT_FOUND: 'Product not found.',
    OUT_OF_STOCK: 'Product is out of stock.',
    VENDOR_NOT_APPROVED: 'Vendor not approved yet.',
    IMAGE_LIMIT_EXCEEDED: 'Image upload limit exceeded.',
  },
  ORDER: {
    NOT_FOUND: 'Order not found.',
    INVALID_STATUS_TRANSITION: 'This status change is not allowed.',
    MIN_AMOUNT: 'Order amount is below minimum.',
    CANCEL_WINDOW_PASSED: 'Cancellation window passed.',
    STOCK_CHANGED: 'Stock changed, please retry.',
  },
  CART: {
    EMPTY: 'Cart is empty.',
    ITEM_NOT_FOUND: 'Cart item not found.',
    MAX_ITEMS: 'Maximum cart items reached.',
  },
  COUPON: {
    NOT_FOUND: 'Coupon not found.',
    EXPIRED: 'Coupon expired.',
    MIN_NOT_MET: 'Coupon minimum order amount not met.',
    USAGE_LIMIT: 'Coupon usage limit reached.',
    INVALID: 'Coupon is invalid.',
  },
  PAYMENT: {
    FAILED: 'Payment failed.',
    NOT_FOUND: 'Payment not found.',
    ALREADY_PAID: 'Payment already done.',
  },
  RETURN: {
    NOT_FOUND: 'Return not found.',
    WINDOW_PASSED: 'Return window passed.',
    INVALID_STATUS: 'Invalid return status.',
  },
  TICKET: {
    NOT_FOUND: 'Ticket not found.',
    CLOSED: 'Ticket is closed.',
  },
  UPLOAD: {
    FILE_REQUIRED: 'File is required.',
    TOO_MANY_FILES: 'Too many files.',
    UNSUPPORTED_TYPE: 'Unsupported file type.',
    PAYLOAD_TOO_LARGE: 'File size exceeds limit.',
  },
  COMMON: {
    SERVER_ERROR: 'Something went wrong. Please try again.',
    VALIDATION_FAILED: 'Validation failed.',
    RATE_LIMITED: 'Too many requests, please try again later.',
    NOT_FOUND: 'Resource not found.',
    FORBIDDEN: 'You do not have permission.',
    DUPLICATE: 'Duplicate value.',
    MAINTENANCE: 'Service under maintenance.',
  },
};
```

`src/messages/validation.ts`

```ts
export const VALIDATION = {
  REQUIRED: (field: string) => `${field} is required.`,
  INVALID_EMAIL: 'Please enter a valid email address.',
  MIN_LENGTH: (field: string, n: number) => `${field} must be at least ${n} characters.`,
  MAX_LENGTH: (field: string, n: number) => `${field} must not exceed ${n} characters.`,
  INVALID_PHONE: 'Please enter a valid phone number.',
  INVALID_URL: 'Please enter a valid URL.',
  INVALID_NUMBER: 'Please enter a valid number.',
  INVALID_DATE: 'Please enter a valid date.',
  INVALID_ENUM: (field: string) => `${field} has invalid value.`,
  STRICT_FIELD: (field: string) => `Unknown field: ${field}`,
};
```
