# INKHAUS — monorepo

Custom apparel storefront (Next.js) + backend (NestJS · Prisma · PostgreSQL).

```
apps/
  web/        Next.js 16 storefront + Design Studio  (port 4321)
  api/        NestJS 11 REST API + Prisma            (port 4000)
packages/
  shared/     domain types, the volume-price ladder, and the demo catalog
              the seed loads — imported by both apps
  env/        finds the repo root and loads the one .env — imported by every app
.env                 every environment variable in the project
docker-compose.yml   PostgreSQL 17
```

npm workspaces. `packages/shared` is the single source of truth for the pricing
maths, so the calculator in the browser and the money the API actually charges
can never drift apart.

## Getting started

```bash
npm run setup      # install + build shared + prisma generate
npm run db:up      # PostgreSQL 17 in Docker on :5432
cp .env.example .env   # one file, read by all three apps

npm run db:migrate # apply prisma/migrations
npm run db:seed    # the catalog, plus an OWNER row per ADMIN_BOOTSTRAP_EMAILS

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

## API

Everything is under `/api/v1`. Validation is global (`whitelist` +
`forbidNonWhitelisted`), rate limiting is 120 req/min, and the back-office routes
want `Authorization: Bearer <session token>` — see [Back-office auth](#back-office-auth).

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | includes a real `SELECT 1` against Postgres |
| GET | `/catalog/products` | `?type=&q=&limit=` — returns the exact `Product` shape the storefront already renders |
| GET | `/catalog/products/:slug` | |
| GET | `/catalog/colors` · `/catalog/sizes` · `/catalog/price-tiers` · `/catalog/print-methods` | |
| GET | `/assets/clipart?q=` · `/assets/fonts` · `/assets/ink-colors` | design studio library |
| POST | `/pricing/quote` | prices a size/qty grid against the live ladder |
| POST · GET | `/designs` · `/designs/:publicId` | saves the fabric.js scene per side, returns a shareable id — public, the id *is* the share link |
| GET · PATCH · DELETE | `/designs?email=` · `/designs/:publicId` | owner only; listing or destroying someone's artwork is not a production task |
| POST | `/orders` | places an order — **every price is recomputed server side** |
| GET | `/orders/:number` | order status + timeline |
| GET · PATCH | `/orders` · `/orders/:number/status` | staff; moves validated against the transition table, and cancel/refund need an owner |
| POST | `/bulk-quotes` | the `/bulk` calculator lead form, snapshots the quoted price |
| GET · PATCH | `/bulk-quotes` · `/bulk-quotes/:id` | staff |
| POST | `/admin/auth/google` | swaps a Google `id_token` for a session token |
| POST · GET | `/admin/auth/logout` · `/admin/auth/me` | staff |
| GET · POST | `/reviews` | submissions are held unpublished |

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

**`admin_users` is the allowlist.** A perfectly valid Google account with no row
there is refused, and signing in never creates one. Rows come from
`ADMIN_BOOTSTRAP_EMAILS` via `npm run db:seed`.

Two roles, and the difference is enforced in the API, not just hidden in the UI:

| | OWNER | STAFF |
|---|---|---|
| View orders and quotes, triage quotes | ✅ | ✅ |
| Move an order to paid / in production / shipped / delivered | ✅ | ✅ |
| Move an order to **cancelled / refunded** | ✅ | ❌ |
| List, edit or delete designs | ✅ | ❌ |

Cancel and refund depend on a *value* rather than a route, so they cannot be a
plain guard: `canSetStatus` in `@inkhaus/shared` is what both the dropdown and
`OrdersService` read, which is the same trick `ORDER_TRANSITIONS` uses.

#### Creating the Google OAuth client

1. <https://console.cloud.google.com> → pick or create a project.
2. **APIs & Services → OAuth consent screen** → **External**. Fill in the app
   name and support email, leave it in **Testing**, and add each admin address
   under **Test users**. In Testing mode Google does not review the app.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Under **Authorized redirect URIs** add every origin the app runs on:
   - `http://localhost:4322/auth/google/callback`
   - `https://admin.<your-domain>/auth/google/callback`
5. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the root `.env`. Both
   apps read the same pair from there — the admin app runs the OAuth dance and
   needs both halves, the API only checks the `aud` claim and never sees the
   secret it does not need.

Scopes are `openid email profile`, which are default; no API needs enabling.

### Pricing rules the API enforces

- The volume tier is applied to the **total across sizes**, not per line — 6×M + 6×L
  earns the 12+ tier.
- `bulkPrice` is a hard floor; no discount stack goes under it.
- Size upcharges (2XL +$2, 3XL +$4) are added per line on top of the tier price.
- A product can only be ordered in a colour it stocks and a print method it supports;
  a design can only be ordered on the blank it was made for.

## Data model

`apps/api/prisma/schema.prisma`. What the storefront hard-coded is now tables —
`products`, `colors`, `product_colors`, `sizes`, `price_tiers`, `clipart`, `fonts`,
`ink_colors` — and what did not exist at all is now modelled: `designs`,
`customers`, `orders` / `order_items` / `order_item_sizes` / `order_events`,
`bulk_quotes`, `reviews`.

Order numbers come from a database sequence (`orders.seq`) formatted as `INK-000123`,
so two concurrent checkouts cannot collide.

Re-running `npm run db:seed` is safe — everything upserts on its natural key, and
product colour links are rebuilt so removing a colourway in
`packages/shared/src/catalog.ts` actually unstocks it.

## Web app

Pages still render from `packages/shared` (the same data the seed loads), so the
storefront runs with the API down. `apps/web/src/lib/api.ts` is the typed client for
switching a page to live data — e.g. in a server component:

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
  one; they agree because both call the same `quote()`.
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
| `npm run test:e2e` | Playwright, real Chromium, over admin sign-in and the role rules — needs `db:up` |
| `npm run db:up` / `db:down` | Postgres container |
| `npm run db:migrate` / `db:deploy` / `db:reset` / `db:seed` / `db:studio` | Prisma |
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

`npm run test:e2e` starts its own API, admin and database fixtures on dedicated
ports (4001 / 4323) so it never fights a dev server you already have open. It
also starts `apps/admin/e2e/fake-google.mjs`, a local OIDC provider that stands
in for Google: the browser, the redirects and the signed JWTs are all real, only
the issuer is local. Google actively blocks automated browsers, and there is no
way at all to test the case that matters most — a valid Google account that is
*not* on the allowlist being refused — with a real account.

## Not built yet

Payments (checkout places the order and stops at `PENDING_PAYMENT` — the proof is
sent before any money is asked for), customer accounts (an order is still looked
up by its number alone), server-side print-file rendering, POD partner
integration, object storage for design previews — they are still data-urls,
which is why the API's JSON body limit had to be raised to 12 MB. There is also
no deployment story for the API yet: no Dockerfile, no CI, and `docker-compose`
only brings up Postgres.
