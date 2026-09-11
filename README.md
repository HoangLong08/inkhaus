# INKHAUS — monorepo

Custom apparel storefront (Next.js) + back office (Next.js) + backend (NestJS · Prisma · PostgreSQL).

```
apps/
  web/        Next.js 16 storefront + Design Studio  (port 4321)
  admin/      Next.js 16 back office                 (port 4322)
  api/        NestJS 11 REST API + Prisma            (port 4000)
packages/
  shared/     domain types, the volume-price ladder, the order and quote
              rules, the back-office capability table, and the demo catalog
              the seed bootstraps from — imported by all three apps
  env/        finds the repo root and loads the one .env — imported by every app
  oidc-stub/  a local OIDC provider that stands in for Google — e2e suites only
.env                 every environment variable in the project
docker-compose.yml   PostgreSQL 17
```

npm workspaces. `packages/shared` is the single source of truth for the pricing
*maths* — `quote()`, the per-order tier rule, the bulk-price floor — so the
calculator in the browser and the money the API actually charges run the same
code. The *numbers* it runs on are another matter since the back office arrived:
the API reads prices, upcharges and the ladder from the database, the storefront
still reads them from `packages/shared`, and
[`CATALOG_PRICE_EDITS`](#catalog_price_edits) is what keeps the two equal for now.

`packages/shared` reaches client bundles, so it stays dependency-free and
browser-safe, and anything a browser needs comes through a subpath —
`@inkhaus/shared/orders`, `/admin`, `/pricing`, `/taxonomy` — so the admin
sidebar does not drag 24 products and their photography along with it.

## Getting started

```bash
npm run setup      # install + build shared + prisma generate
npm run db:up      # PostgreSQL 17 in Docker on :5432
cp .env.example .env   # one file, read by all three apps

npm run db:migrate # apply prisma/migrations
npm run db:seed    # bootstrap an empty catalog, plus an active OWNER per ADMIN_BOOTSTRAP_EMAILS

npm run dev        # shared (tsc --watch) + api + web + admin together
```

Signing in to the admin app needs a Google OAuth client — see
[Back-office auth](#back-office-auth). Everything else runs without it.

| URL | What |
|---|---|
| http://localhost:4321 | storefront |
| http://localhost:4322 | admin back office |
| http://localhost:4000/api/v1 | API |
| http://localhost:4000/api/docs | Swagger UI |
| `npm run db:studio` | Prisma Studio |

## Environment

**There is one `.env`, and it is at the repo root.** No `apps/api/.env`, no
`apps/web/.env.local`, no third copy of the Google client id. `.env.example`
documents every variable with the reason it exists; copy it once and edit that.

`packages/env` is what makes that work. It walks up to the workspaces root and
loads the cascade sitting there, so it does not matter which directory a process
was started from — `npm run dev` at the root and `next dev` from inside
`apps/web` read the same file. Each entry point calls it as early as it can:

| Where | How |
|---|---|
| `apps/api` | `src/load-env.ts`, the first import in `main.ts` — before the modules that read `process.env` while they are still being evaluated |
| `apps/api` Prisma | `prisma.config.ts`, which also hands the environment to the seed processes Prisma spawns |
| `apps/web` · `apps/admin` | `next.config.mjs`. Next folds anything the config adds into its own baseline, so `NEXT_PUBLIC_*` is still inlined at build time |
| `apps/admin` e2e | `playwright.config.ts`, for `DATABASE_URL` and `CHROME_PATH` |
| `apps/web/scripts/*.mjs` | at the top of each script |

Three rules are worth knowing before editing the file:

- **The real environment always wins.** Anything already exported — by your
  shell, by Docker, by a Playwright `webServer.env` — beats the file. That is
  what lets the e2e suite aim one API process at a fake Google while the same
  `.env` still names the real one.
- **Values are literal; there is no `$VAR` expansion.** `dotenv-expand` would
  quietly truncate a password like `pa$$w` to `pa`, and losing a secret is worse
  than losing a convenience.
- **`NODE_ENV` is not in there.** The tooling sets it — `next dev` means
  development, `next build` means production, Playwright means test — and one
  value pinned in a file shared by four processes would be wrong for at least one
  of them.

The API's port is `API_PORT`, not `PORT`: a bare `PORT` in a file the two Next
apps also read would send one of them at 4000. A platform-injected `PORT` is
still honoured as the fallback.

One trade-off comes with the merge: every process can now read every value,
`GOOGLE_CLIENT_SECRET` included. Nothing reaches a browser unless its name
starts with `NEXT_PUBLIC_`, but a secret the storefront must not even be able to
read would be the reason to give it its own file again.

### `CATALOG_PRICE_EDITS`

Off by default, and only the exact string `true` turns it on. It decides whether
the back office may change what anything costs.

Checkout prices every order from the database, but the storefront still
*displays* prices from `packages/shared`. A price changed in the back office
would put one number on the product page and charge another, so while the flag
is off the API answers **409** to every write that touches money:

- `price` or `bulkPrice` on a product
- a size's upcharge — changing one, or creating a size, which carries one
- replacing the tier ladder
- creating a product — a new blank carries a price

Content, colours, `active` and sort order stay editable either way.
`GET /admin/catalog/options` reports `priceEditsEnabled`, which is how the admin
locks those fields and shows its `price-sync-warning` before anyone types. It is
a 409 rather than a 403 because nobody lacks permission — the system is in a
state where the change would be wrong; `catalog.price` still decides *who* may
make it once it is allowed.

The admin e2e suite starts its API with the flag on, so price, tier and
product-create edits are exercised end to end; the off branch has its own unit
test (`price-edits.policy.spec.ts`). Turn it on for real only once the
storefront reads prices from the API.

## API

Everything is under `/api/v1`. Validation is global (`whitelist` +
`forbidNonWhitelisted`), rate limiting is 120 req/min (sign-in has its own,
tighter limit), and the back-office routes want `Authorization: Bearer <session
token>` — see [Back-office auth](#back-office-auth).

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | includes a real `SELECT 1` against Postgres |
| GET | `/catalog/products` | `?type=&q=&limit=` — active blanks only, in the exact `Product` shape the storefront already renders |
| GET | `/catalog/products/:slug` | 404 for an archived blank |
| GET | `/catalog/colors` · `/catalog/sizes` · `/catalog/price-tiers` · `/catalog/print-methods` | |
| GET | `/assets/clipart?q=` · `/assets/fonts` · `/assets/ink-colors` | design studio library |
| POST | `/pricing/quote` | prices a size/qty grid against the live ladder |
| POST · GET | `/designs` · `/designs/:publicId` | saves the fabric.js scene per side, returns a shareable id — public, the id *is* the share link |
| GET · PATCH · DELETE | `/designs?email=` · `/designs/:publicId` | owner only (`@Roles('OWNER')`, not `@Can`); listing or destroying someone's artwork is not a production task. `GET ?email=` is **deprecated** → `GET /admin/designs?customerId=`, which never loads the scene or the previews |
| POST | `/orders` | places an order — **every price is recomputed server side** |
| GET | `/orders/:number` | status, tracking and the public timeline — status and tracking events only |
| GET | `/orders/mine` | the signed-in shopper's own orders; scoped by session, never by a parameter |
| GET · PATCH | `/orders` · `/orders/:number/status` | **deprecated** → `/admin/orders…`. Staff; moves run through the same workflow as the admin route |
| POST | `/bulk-quotes` | the `/bulk` calculator lead form, snapshots the quoted price |
| GET · PATCH | `/bulk-quotes` · `/bulk-quotes/:id` | **deprecated** → `/admin/bulk-quotes…`. Staff |
| POST | `/auth/google` | swaps a Google `id_token` for a **storefront** session token |
| POST · GET | `/auth/logout` · `/auth/me` | signed-in shoppers |
| GET · POST | `/reviews` | `GET` lists `PUBLISHED` only; a submission lands as `PENDING` |

The deprecated routes belong to the first back office. They stay because
existing callers and e2e suites still use them, and they are flagged
`deprecated` in Swagger — but their writes go through the same services as the
`/admin/*` routes that replace them, so every way in records who did it, runs in
a transaction and obeys the same rules. See
[What changed on the existing routes](#what-changed-on-the-existing-routes).

### Back-office routes

Everything under `/admin` except sign-in wants a back-office session, and every
handler names the one capability it needs with `@Can` — the middle column; see
[Roles and capabilities](#roles-and-capabilities). Paginated lists take `page`
and `limit` (at most 100). Dates in a query are `from`/`to` as UTC `YYYY-MM-DD`,
both inclusive, either one alone.

**Auth**

| Method | Route | `@Can` | What |
|---|---|---|---|
| POST | `/admin/auth/google` | — | swaps a Google `id_token` for a **back-office** session token; 10/min per IP (`ADMIN_LOGIN_RATE_LIMIT`) |
| POST · GET | `/admin/auth/logout` · `/admin/auth/me` | signed in | revokes the calling session · who the token belongs to |

**Stats**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/stats/overview` | `stats.view` | `?range=7d\|30d\|90d\|365d` (default 30d) or `?from=&to=` (inclusive UTC days). All-time queues: `orders.byStatus`, `quotes.byStatus`, `reviews.pending`, `drafts`. For the range: `orders.placed`, `revenue {gross, orders, averageOrder, refunded}` (revenue = PAID through DELIVERED), a zero-filled daily `series`, the top five products, `quotes {created, createdByStatus, conversionRate}`. Plus `attention`: NEW quotes older than 48h, overdue follow-ups, PAID/IN_PRODUCTION orders untouched for 3 days |

**Orders & export**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/orders` | `orders.view` | the list: `q` (part of a number, customer email or name, or ship-to name — `900002` finds `INK-900002`), `status`, `from`/`to` (placed day; drafts by created day), `sort` (`ORDER_SORTS`, default `placed_desc`), `customerId` |
| GET | `/admin/exports/orders.csv` | `orders.export` | the same filters as a streamed CSV — at most 10,000 rows (`X-Export-Truncated: true` past that), `no-store`, audited, every cell guarded against spreadsheet formulas |

**Order detail & designs**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/orders/:number` | `orders.view` | the order as staff see it: internal notes, who did what, per-size pricing, the customer, tracking, the quote it came from |
| PATCH | `/admin/orders/:number/status` | `orders.advance` + `canSetStatus` | `{status, note ≤ 500, tracking?}`. `SHIPPED` needs tracking, sent now or already on the order; a move that lost a race is a 409 |
| POST | `/admin/orders/:number/notes` | `orders.note` | an internal note (≤ 1000) — never shown to the customer |
| PUT | `/admin/orders/:number/tracking` | `orders.tracking` | add or correct tracking without moving the order — `IN_PRODUCTION`, `SHIPPED` or `DELIVERED` only |
| GET | `/admin/designs/:publicId/preview` | `orders.view` | a design's name and mockup previews, never the studio scene. `orders.view`, not `designs.view`: the id comes off an order line and is already a public share link |
| GET | `/admin/designs?customerId=` | `designs.view` | a customer's newest 60 designs for the profile's Designs tab — name, product, date and whether each side has a preview, worked out in the database so no preview or scene is loaded |

Every write under `/admin/orders/:number` answers with the whole detail, so the
page swaps its cache entry for the server's version in one step.

**Bulk quotes**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/bulk-quotes` | `quotes.manage` | `q` (email, name or company), `status`, `assignee` (`me`, `none` or an admin id), `followUp` (`overdue` · `upcoming`), `sort` |
| GET | `/admin/bulk-quotes/:id` | `quotes.manage` | the quote with its customer, history and a live re-estimate against today's prices |
| PATCH | `/admin/bulk-quotes/:id` | `quotes.manage` | `{status?, assigneeId?, followUpAt?}` — one timeline event per changed field. The assignee must be active staff, the follow-up is a UTC day or `null`, and a converted quote stays `WON` |
| POST | `/admin/bulk-quotes/:id/notes` | `quotes.manage` | a staff note on the quote's history (≤ 1000) |
| POST | `/admin/bulk-quotes/:id/convert` | `quotes.convert` | `{productSlug, colorSlug, method, sizes, designId?, notes?, shipping?}` → a `DRAFT` order priced from the database; the quote becomes `WON` and links to it. Once only, never from `LOST` — 409 |

**Customers**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/customers` | `customers.view` | `q` (email, name, company or phone), `sort` (`CUSTOMER_SORTS`), `hasOrders=yes\|no`; order count and lifetime value per row |
| GET | `/admin/customers/:id` | `customers.view` | totals, the staff note, recent orders and quotes, a design count |
| PATCH | `/admin/customers/:id` | `customers.edit` | `{name?, phone?, company?, adminNote?}` — `""` or `null` clears one; the email cannot change (a body carrying one is a 400). Audited |

**Catalog**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/catalog/products` | `catalog.view` | archived included: `q`, `category`, `type`, `active=all\|active\|archived`, `sort` |
| GET | `/admin/catalog/products/:slug` | `catalog.view` | colours, images (read-only), order count and change history |
| POST | `/admin/catalog/products` | `catalog.create` | a new blank; 409 for a taken slug, or while price edits are off |
| PATCH | `/admin/catalog/products/:slug` | `catalog.edit` | content, methods, sizes, colours, `active`, sort order. `price`/`bulkPrice` also need `catalog.price` (403) and price edits on (409). Audited before/after |
| GET · POST | `/admin/catalog/colors` | `catalog.view` · `catalog.edit` | every colour, archived included, with product and order-line counts · a new one |
| PATCH | `/admin/catalog/colors/:slug` | `catalog.edit` | rename, re-hex, reorder or archive — there is no delete |
| GET · POST | `/admin/catalog/sizes` | `catalog.view` · `catalog.price` | every size with its upcharge and usage · a new code (409 while price edits are off) |
| PATCH | `/admin/catalog/sizes/:code` | `catalog.edit` | relabel or reorder; an `upcharge` also needs `catalog.price` and price edits on |
| DELETE | `/admin/catalog/sizes/:code` | `catalog.price` | 409 for the default run or a code any product stocks |
| GET · PUT | `/admin/catalog/price-tiers` | `catalog.view` · `catalog.price` | the ladder · replace it whole: `validateTiers` (400), price edits on (409), audited |

**Reviews**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/reviews` | `reviews.moderate` | newest first: `status`, `rating`, `product` (a slug), `q` |
| PATCH | `/admin/reviews/:id` | `reviews.moderate` | `{status}` — publish, reject, or back to pending; records who and when |
| POST | `/admin/reviews/bulk` | `reviews.moderate` | `{ids, status}` — 1 to 50 reviews, all or nothing |
| DELETE | `/admin/reviews/:id` | `reviews.delete` | gone for good; the audit log keeps a copy |

**Staff**

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/staff` | `staff.view` | every account, active first, with sessions, inviter and the active-owner count |
| POST | `/admin/staff` | `staff.manage` | `{email, name?, role}` — adds a Google account to the allowlist. No email is sent; 409 if it is already there |
| PATCH | `/admin/staff/:id` | `staff.manage` | `{name?, role?, isActive?}` in a Serializable transaction. Yourself is a 400, the last active owner a 409, a lost race a 409; deactivating ends every session |
| DELETE | `/admin/staff/:id/sessions` | `staff.manage` | signs someone out everywhere without touching their access; 400 for yourself — that is what Sign out is for |

**Lookups** — shared reference data the forms build from

| Method | Route | `@Can` | What |
|---|---|---|---|
| GET | `/admin/staff/directory` | `orders.view` | active staff — id, name, email, role — for assignee pickers; every role needs names |
| GET | `/admin/catalog/options` | `catalog.view` | active products with their prices, methods, sizes and active colours, the ladder, and `priceEditsEnabled` |

### What changed on the existing routes

- **`PATCH /bulk-quotes/:id`** — `message` is appended to the quote's history as
  a staff note. It used to overwrite what the customer wrote; the customer's own
  message is now never touched.
- **`PATCH /orders/:number/status`** — runs through the same transactional
  workflow as the admin route: the actor is recorded, a move that lost a race is
  a 409, and moving to `SHIPPED` needs `tracking: {carrier, number}` unless the
  order already has one. Re-sending the current status, which is how the old
  admin attached a note, still works and becomes an internal note. The note
  limit is `ORDER_NOTE_MAX` (500), the number the admin form checks too.
- **`GET /catalog/products?includeInactive=…`** is a 400 now. The switch was
  public, so anyone could list archived blanks; they live behind
  `/admin/catalog`.
- **The public order DTO** (`/orders/:number`, `/orders/mine`) gains
  `tracking: {carrier, number, url} | null`. Its timeline carries `STATUS` and
  `TRACKING` events only — an internal note never leaves the back office — and
  never says which member of staff did anything.
- **`POST /reviews`** lands as `PENDING`, and `GET /reviews` lists `PUBLISHED`
  only. A review reaches the storefront once someone publishes it.
- **`GET /orders/:number`** is a 404 for an order that was never placed - a
  `DRAFT` a quote was converted into, or such a draft after it was cancelled -
  and `GET /orders/mine` leaves them out. A draft carries what staff typed in the
  convert dialog; it becomes the customer's order page once it moves to
  `PENDING_PAYMENT`.
- **Tracking** is accepted on a status move only into `SHIPPED`, or while an
  order is in production, shipped or delivered; re-sending the tracking an order
  already has writes nothing.

### Storefront accounts

Sign-in to `apps/web` is **Google only** as well, and shares the same OAuth
client as the back office — but almost nothing else.

The mechanics are the same backend-for-frontend: the storefront runs the
authorization-code + PKCE dance in Route Handlers under `/api/auth/google/`,
hands the `id_token` to `POST /auth/google`, and the API verifies the signature
against Google's JWKS itself. The session token comes back into an HttpOnly
cookie on the storefront's own origin, named `inkhaus_session` — deliberately
not the admin app's `inkhaus_admin`, because cookies are not scoped by port and
on localhost the two apps share a hostname.

Three things are deliberately different from the back office:

- **There is no allowlist.** Anyone with a verified Google account may sign in,
  and signing in creates the `customers` row if it does not exist. Refusing
  unknown addresses would mean a sign-in button that only works for people who
  have already ordered.
- **Guest orders come with the account.** `customers` has always been keyed by
  email, created by the first order, saved design or bulk quote from that
  address. Google has just proved the person owns that address, so their history
  is there on the very first sign-in — nothing to claim or merge.
- **Sessions last 30 days, not 12 hours** (`CUSTOMER_SESSION_TTL_DAYS`). A
  shopper checking an order next week should not be signed out; a session that
  can see *every* order in the system should be.

The two session tables are separate (`customer_sessions` / `admin_sessions`) and
so are the guards, which makes "a shop token cannot open the till" a schema
guarantee rather than a code review — there is an e2e test that signs in as a
seeded OWNER on the storefront and confirms the API still refuses them
`GET /orders`.

One property worth knowing: because guest checkout takes an email address on
trust, an order placed with someone else's address will appear in that person's
account once they sign in. It is visible, not actionable — the account cannot
change or cancel anything — and it goes away when checkout grows payment, which
is the point at which an address stops being self-asserted.

Only `/account`, `/sign-in` and the three `/api/auth/` handlers are
server-rendered per request. The session is never read in the root layout: doing
that to decorate one header button would opt the entire catalogue — every
product page the PWA precaches — out of being static. The header asks
`GET /api/auth/session` instead, and its link points at `/account` either way,
so it is correct before any JavaScript runs.

### Back-office auth

Sign-in to `apps/admin` is **Google only**. There is no password anywhere in the
system — the `admin_users` table has no such column.

The flow is a backend-for-frontend: the admin app runs the OAuth dance
(authorization code + PKCE) in Route Handlers, hands the resulting `id_token` to
`POST /admin/auth/google`, and the API verifies the signature against Google's
JWKS itself. The admin app is never trusted to vouch for an identity; it only
drives the browser end. The session token it gets back is stored in an HttpOnly
cookie on the admin's own origin, so it never reaches page scripts, and
`CORS_ORIGIN` needs no entry for admin because every API call is server-to-server.
The browser never talks to the API at all: client-side queries call same-origin
route handlers under `/api/admin/*`, which call the API with the caller's own
token.

**`admin_users` is the allowlist.** A perfectly valid Google account with no row
there is refused, and signing in never creates one. Rows come from two places:
an owner adding an address on the Staff screen — no email is sent, the person
just signs in with that Google account — and `ADMIN_BOOTSTRAP_EMAILS` via
`npm run db:seed`, which doubles as the [break-glass](#seeding). Sessions are
rows too, so deactivating someone deletes their sessions in the same transaction
and they are out on their next request.

#### Roles and capabilities

Two roles. What each may do is one table, `ADMIN_CAPABILITIES` in
`@inkhaus/shared/admin`, and nothing else decides it:

| Capability | OWNER | STAFF | Covers |
|---|---|---|---|
| `stats.view` | ✅ | ✅ | the overview |
| `orders.view` | ✅ | ✅ | the order list and detail, design previews on an order, the staff directory |
| `orders.advance` | ✅ | ✅ | moving an order on — cancel and refund are owners' still, see below |
| `orders.note` | ✅ | ✅ | internal order notes |
| `orders.tracking` | ✅ | ✅ | adding or correcting tracking |
| `quotes.manage` | ✅ | ✅ | the quote list and detail, status, assignee, follow-up, notes |
| `quotes.convert` | ✅ | ✅ | turning a quote into a draft order |
| `customers.view` | ✅ | ✅ | the customer list and profile |
| `customers.edit` | ✅ | ✅ | name, phone, company, the staff note |
| `catalog.view` | ✅ | ✅ | products, colours, sizes, the ladder, the form lookups |
| `catalog.edit` | ✅ | ✅ | product content, colours, size labels, `active`, sort order |
| `reviews.moderate` | ✅ | ✅ | publish, reject, back to pending, in bulk |
| `orders.export` | ✅ | ❌ | the CSV — a bulk export of personal data |
| `designs.view` | ✅ | ❌ | customer artwork, including designs never ordered |
| `catalog.price` | ✅ | ❌ | price, bulk price, size upcharges and the tier ladder — money |
| `catalog.create` | ✅ | ❌ | a new blank, which carries a price |
| `reviews.delete` | ✅ | ❌ | deleting a review for good |
| `staff.view` | ✅ | ❌ | the Staff screen |
| `staff.manage` | ✅ | ❌ | inviting, promoting, demoting, deactivating, ending sessions |

The table is enforced three times, and all three are load-bearing: the admin UI
hides or disables what a role may not do with `can()` (the sidebar filters on it
too), the admin's route handler refuses it with `requireCapability(action)` →
403, and the API refuses it again with `@Can(action)` — where `CapabilityGuard`
refuses any handler that declares no `@Can` at all, so an endpoint added without
one fails closed instead of quietly opening to every role. A few rules depend on
a *value* in the body rather than the route, so no route-level capability can
express them and they are shared functions both ends call instead: `canSetStatus`
keeps cancel and refund to owners on the same endpoint that makes every other
move, the price fields on a product or size need `catalog.price` on top of
`catalog.edit`, and `staffChangeError` means nobody changes their own role or
deactivates themselves and the last active owner can be neither demoted nor
deactivated.

#### Creating the Google OAuth client

1. <https://console.cloud.google.com> → pick or create a project.
2. **APIs & Services → OAuth consent screen** → **External**. Fill in the app
   name and support email, leave it in **Testing**, and add every address that
   needs to sign in — staff *and* any shopper you want to test with — under
   **Test users**. In Testing mode Google does not review the app, but it also
   refuses anyone not on that list, which looks exactly like a broken sign-in.
   Publishing the app is what lifts that, and it is required before real
   customers can sign in to the storefront.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Under **Authorized redirect URIs** add every origin either app runs on. The
   storefront and the back office share one client; only the URIs differ:
   - `http://localhost:4321/api/auth/google/callback` — storefront
   - `http://localhost:4322/api/auth/google/callback` — back office
   - `https://<your-domain>/api/auth/google/callback`
   - `https://admin.<your-domain>/api/auth/google/callback`

   They must match character for character, including the port and the `/api`
   segment. A missing entry fails late — Google shows `redirect_uri_mismatch`
   *after* the account picker, not before it.
5. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the root `.env`. All
   three apps read the same pair from there — both Next apps run the OAuth dance
   and need both halves, the API only checks the `aud` claim and never sees the
   secret it does not need.

Scopes are `openid email profile`, which are default; no API needs enabling.

### Pricing rules the API enforces

- The volume tier is applied to the **total across sizes**, not per line — 6×M + 6×L
  earns the 12+ tier.
- `bulkPrice` is a hard floor; no discount stack goes under it.
- Size upcharges (seeded as 2XL +$2, 3XL +$4) are added per line on top of the
  tier price.
- A product can only be ordered in a colour it stocks and a print method it supports;
  a design can only be ordered on the blank it was made for. An archived product
  cannot be ordered at all.

## Data model

`apps/api/prisma/schema.prisma`. What the storefront hard-coded is now tables —
`products`, `colors`, `product_colors`, `sizes`, `price_tiers`, `clipart`, `fonts`,
`ink_colors` — and what did not exist at all is now modelled: `designs`,
`customers`, `orders` / `order_items` / `order_item_sizes` / `order_events`,
`bulk_quotes` / `quote_events`, `reviews`, and for the back office
`admin_users` / `admin_sessions` / `admin_audit_logs`.

Order numbers come from a database sequence (`orders.seq`) formatted as `INK-000123`,
so two concurrent checkouts cannot collide. A status move is one transaction that
only writes if the order is still in the status it read, so two people moving the
same order at once get one success and one 409 rather than two timeline entries.

What the back office added:

| Table | What |
|---|---|
| `order_events` | `kind` — `STATUS` · `NOTE` · `TRACKING` — and `actorId`. Status and tracking are the customer's history; a note is staff talking to staff. The actor is never public, and is null for the storefront and for history older than the column |
| `orders` | `carrier` + `trackingNumber` (required before `SHIPPED`), `shippedAt`, `deliveredAt`. `placedAt` is set only on the move to `PENDING_PAYMENT` - a `DRAFT`, and a draft cancelled before it was placed, keep it null |
| `bulk_quotes` | `assigneeId`, `followUpAt` (midnight UTC of the chosen day), `convertedOrderId` — unique, so a quote becomes an order at most once — and `updatedAt`. `message` is the customer's and is never overwritten |
| `quote_events` | new: `STATUS` · `NOTE` · `ASSIGNED` · `FOLLOW_UP` · `CONVERTED`, each with its actor. There is no `CREATED`; "Received" is the quote's own `createdAt` |
| `reviews` | the `published` boolean became `status` — `PENDING` · `PUBLISHED` · `REJECTED` — plus `moderatedAt` and `moderatedById` |
| `colors` | `active`. An archived colour stays on the products and orders that have it but cannot be added to another; colours and products are archived, never deleted, because order lines point at them |
| `customers` | `adminNote` — staff-only, never sent to the storefront |
| `admin_users` | `invitedById` (null for a seeded bootstrap owner) and `deactivatedAt` |
| `admin_audit_logs` | new, append-only: every back-office change with no timeline of its own — catalog and price edits, customer edits, review moderation and deletes, staff changes, CSV exports. `action` is a dotted verb (`product.update`, `tiers.replace`, `staff.deactivate`, `orders.export`); `before`/`after` hold only the fields that changed, never a secret |

### Seeding

**The database is the catalog's source of truth.** The back office edits
products, colours, sizes and the tier ladder in place, so `npm run db:seed` only
bootstraps what is missing and never overwrites an edit:

- a product whose slug already exists is skipped entirely — its fields, colour
  links and photos all stay as the back office left them;
- a colour or size that exists is left alone; only missing ones are created;
- the tier ladder is written only into an empty table, never upserted tier by
  tier — that would resurrect a tier an owner deleted.

Re-running it is safe; a second run reports `created 0`. The flip side is that
editing a price or a colourway in `packages/shared` no longer reaches a database
that already has the row — change it on the catalog screens instead. Studio
assets (clip art, fonts, ink colours) are still synced on every run, because no
screen edits them, and reviews are seeded only into an empty table.

**One deliberate exception: the break-glass.** Every address in
`ADMIN_BOOTSTRAP_EMAILS` is upserted as an **active OWNER** on every run — even
one the Staff screen has demoted or deactivated. The Staff screen refuses to
remove the last active owner, but if the office still manages to lock itself
out, putting an address there and re-seeding gets it back in with no SQL. So
**take an address out of `ADMIN_BOOTSTRAP_EMAILS` before deactivating it on the
Staff screen**, or the next seed quietly brings it back.

`npm run db:seed:e2e -w @inkhaus/api` builds the fixtures the e2e suites use and
nothing else: one STAFF account, a shipped order under the storefront test
shopper, a pool of `PENDING_PAYMENT` orders for the status tests to spend, a
customer with a design and three orders, three bulk quotes, reviews across the
moderation states, and an archived product and colour the catalog tests may edit.
It is rebuilt to exactly that state on every run and lives in its own namespace —
`e2e-*` addresses and slugs, `E2E *` review authors, order numbers `INK-900*` —
so it never writes a real row. It needs `db:seed` first and refuses to run when
`NODE_ENV` is production.

## Web app

Pages still render from `packages/shared` (the data the seed bootstraps an empty
database from), so the storefront runs with the API down. Now that the back
office edits the catalog in the database, that is also its biggest gap — see
[Not built yet](#not-built-yet). `apps/web/src/lib/api.ts` is the typed client
for switching a page to live data — e.g. in a server component:

```ts
import { api } from "@/lib/api";
const products = await api.products();   // GET /catalog/products
```

### Product photography

Every blank renders as a live SVG (`apps/web/src/components/Garment.tsx`) unless a
photograph exists for it, so the storefront ships and deploys with no imagery at
all — photos are additive, and a product without them simply keeps its drawing.

The filename carries the metadata; there is no JSON to edit:

```
apps/web/public/products/<slug>/<nn>-<colorkey|any>[@2x].jpg
```

Drop files in, then regenerate the catalog they feed:

```bash
npm run images:sync -w @inkhaus/web   # writes packages/shared/src/product-images.ts
npm run build:shared
```

`apps/web/scripts/crawl-etsy.mjs` can pull them off an Etsy shop. Etsy fronts its
pages with DataDome — plain HTTP and headless Chrome both get a 403 — so that
script drives a real Chrome in a visible window and waits while you answer the
slide-to-verify puzzle once, against a persistent profile. See
`apps/web/scripts/README.md` for that route and the two that need no crawling at
all.

The Design Studio's export note still stands: iOS Safari caps a canvas at
16,777,216 px, so a 12×16in @300 DPI print file (17.2M px) comes back blank. The
studio clamps DPI rather than shipping an empty file — the real fix is to render the
print file server side from the design JSON now that `/designs` stores the scene.

### Cart and checkout

| Route | What |
|---|---|
| drawer | opens from the header button and from every add-to-cart |
| `/cart` | full editor — sizes, colourway, print method, per-line volume tier |
| `/checkout` | contact + US shipping, then `POST /orders` |
| `/orders/:number` | status, timeline and totals as the API reports them |
| `/orders` | look an order up by number; also lists what this browser has placed |

`apps/web/src/lib/cart.ts` holds the whole model. Three things about it are load
bearing:

- **The tier is applied per line, across that line's sizes** — the same rule
  `OrdersService.priceItem` uses. Two lines never pool their quantities, so the
  cart must not sum first and price second.
- **Prices come from `@inkhaus/shared`.** The cart shows a number, the API decides
  one; they agree because both call the same `quote()` — over the same numbers,
  for as long as `CATALOG_PRICE_EDITS` stays off.
- **The cart is the browser's.** It lives in localStorage (with a `sanitizeLines`
  pass on the way back in, so a colourway that has since been unstocked cannot
  reach the till), and two open tabs stay in sync through the `storage` event.

A customised line is only orderable once `POST /designs` has given it a public id.
That is attempted the moment it is added; if the API is unreachable the payload is
parked in IndexedDB (`inkhaus-cart`) and checkout retries it before placing the
order. An order never silently goes to press without its artwork.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | shared watch + api watch + web dev + admin dev |
| `npm run build` | shared → api → web → admin |
| `npm run typecheck` · `npm test` | across all workspaces; `test` is unit-only so it runs without Postgres |
| `npm run test:e2e` | Playwright, real Chromium, over both sign-in flows, the role rules and every back-office screen — needs `db:up` |
| `npm run db:up` / `db:down` | Postgres container |
| `npm run db:migrate` / `db:deploy` / `db:reset` / `db:seed` / `db:studio` | Prisma |
| `npm run db:seed:e2e -w @inkhaus/api` | rebuild the e2e fixtures; the admin suite's global setup runs it on every run |
| `npm run images:sync -w @inkhaus/web` | rebuild the photo catalog from `apps/web/public/products/` |
| `npm run crawl:etsy -w @inkhaus/web -- --headful` | pull product photography off an Etsy shop |
| `node apps/web/scripts/verify-catalog.mjs` | headless-Chrome pass over the index filters, all 24 product pages, quick view, the mobile buy bar |
| `node apps/web/scripts/verify-cart.mjs` | headless-Chrome pass over add-to-cart → order |
| `node apps/web/scripts/verify-cart-recovery.mjs` | the same flow with the API cut off mid-design |
| `node apps/web/scripts/verify-pwa.mjs` | offline / service-worker verification |

The verify scripts drive a real browser against a running storefront (see the
header comment in each for the exact sequence). They read expected prices out of
`@inkhaus/shared`, so a drift between the browser, the ladder and the API fails
the run rather than reaching a customer.

`npm run test:e2e` runs both browser suites — the back office (`test:e2e:admin`,
91 tests across 12 specs, plus the two setup sign-ins) and the storefront (`test:e2e:web`, 26 tests). Each starts its own API and
database fixtures on dedicated ports (4001 / 4323 and 4002 / 4324) so neither
fights a dev server you already have open, nor each other. They run one after
the other because they share one database.

The back-office suite has two Playwright projects. `setup` (`e2e/auth.setup.ts`)
signs in once as the seeded owner and once as the e2e staff account and saves
each browser state to `apps/admin/e2e/.auth/` — gitignored, because the files
hold live session tokens. `chromium` depends on it, and every spec that is not
*about* signing in starts from `OWNER_STATE` or `STAFF_STATE`; the ones that are
— `auth`, `rbac`, `ui`, `zz-rate-limit` — still walk the flow themselves. Before
either project, `global-setup.ts` runs `db:seed` and `db:seed:e2e`, and the API
it starts runs with `CATALOG_PRICE_EDITS=true`.

Three things about running it:

- **Wait a minute between two runs.** `zz-rate-limit.spec.ts` deliberately
  exhausts the sign-in limiter (40/min under test) and is named to sort last; a
  second run started inside the same minute fails at sign-in, far from the
  cause. The stored sessions are what keep a whole run under that limit — two
  sign-ins for the saved states instead of one or two per test.
- **Delete `apps/admin/.next-e2e` after moving route modules.** The suite's
  Next server builds into its own dir rather than `.next`, so it can run beside
  `npm run dev` — and a stale one keeps serving the old route table, which fails
  as though the new code were wrong.
- A run leaves `apps/admin/next-env.d.ts` pointing at `.next-e2e`; the next
  `npm run dev` points it back. Never commit it aimed at `.next-e2e`.

Both suites also start `packages/oidc-stub`, a local OIDC provider that stands in for
Google: the browser, the redirects and the signed JWTs are all real, only the
issuer is local. Google actively blocks automated browsers, and there is no way
at all to test the cases that matter most — a valid Google account that is *not*
on the back-office allowlist being refused, an unverified address being refused
everywhere — with a real account. It lives in `packages/` rather than in either
app because both suites drive it, through the same client id, which is what the
real system does too.

## Not built yet

Payments (checkout places the order and stops at `PENDING_PAYMENT` — the proof is
sent before any money is asked for), server-side print-file rendering, POD partner
integration, object storage for design previews — they are still data-urls,
which is why the API's JSON body limit had to be raised to 12 MB. There is also
no deployment story for the API yet: no Dockerfile, no CI, and `docker-compose`
only brings up Postgres.

And around the back office:

- **The storefront still reads the catalog and the ladder from
  `packages/shared`**, not the API, while checkout prices from the database.
  Until it reads the API, keep `CATALOG_PRICE_EDITS` off. The same gap means an
  archived product disappears from checkout (it answers 404) but not from the
  storefront's pages.
- **The storefront's order page does not show tracking yet**, though the API
  now sends it.
- **Staff invites send no email.** An owner adds the address; the person has to
  be told to sign in with that Google account.
- **Product photos are read-only paths** in the back office. They are still the
  files under `apps/web/public/products/`, managed by `images:sync` — no upload,
  no object storage.
- **Days are bucketed in UTC** — date filters, follow-up days, the export. An
  evening order in US time can file under tomorrow.
- **The public order lookup is still unauthenticated and sequential.**
  `GET /orders/:number` no longer shows an internal note or a staff name, but
  anyone who guesses a number sees that order.
