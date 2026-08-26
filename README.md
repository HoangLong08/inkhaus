# INKHAUS — monorepo

Custom apparel storefront (Next.js) + backend (NestJS · Prisma · PostgreSQL).

```
apps/
  web/        Next.js 16 storefront + Design Studio  (port 4321)
  api/        NestJS 11 REST API + Prisma            (port 4000)
packages/
  shared/     domain types, the volume-price ladder, and the demo catalog
              the seed loads — imported by both apps
docker-compose.yml   PostgreSQL 17
```

npm workspaces. `packages/shared` is the single source of truth for the pricing
maths, so the calculator in the browser and the money the API actually charges
can never drift apart.

## Getting started

```bash
npm run setup      # install + build shared + prisma generate
npm run db:up      # PostgreSQL 17 in Docker on :5432
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

npm run db:migrate # apply prisma/migrations
npm run db:seed    # load the 8 blanks, 12 colours, 16 clip arts, tiers, reviews

npm run dev        # shared (tsc --watch) + api + web together
```

| URL | What |
|---|---|
| http://localhost:4321 | storefront |
| http://localhost:4000/api/v1 | API |
| http://localhost:4000/api/docs | Swagger UI |
| `npm run db:studio` | Prisma Studio |

## API

Everything is under `/api/v1`. Validation is global (`whitelist` +
`forbidNonWhitelisted`), rate limiting is 120 req/min, and the back-office routes
want an `x-admin-key` header matching `ADMIN_API_KEY`.

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | includes a real `SELECT 1` against Postgres |
| GET | `/catalog/products` | `?type=&q=&limit=` — returns the exact `Product` shape the storefront already renders |
| GET | `/catalog/products/:slug` | |
| GET | `/catalog/colors` · `/catalog/sizes` · `/catalog/price-tiers` · `/catalog/print-methods` | |
| GET | `/assets/clipart?q=` · `/assets/fonts` · `/assets/ink-colors` | design studio library |
| POST | `/pricing/quote` | prices a size/qty grid against the live ladder |
| POST · GET · PATCH · DELETE | `/designs` · `/designs/:publicId` | saves the fabric.js scene per side, returns a shareable id |
| POST | `/orders` | places an order — **every price is recomputed server side** |
| GET | `/orders/:number` | order status + timeline |
| GET · PATCH | `/orders` · `/orders/:number/status` | admin key; status moves are validated against a transition table |
| POST | `/bulk-quotes` | the `/bulk` calculator lead form, snapshots the quoted price |
| GET · PATCH | `/bulk-quotes` · `/bulk-quotes/:id` | admin key |
| GET · POST | `/reviews` | submissions are held unpublished |

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

The Design Studio's export note still stands: iOS Safari caps a canvas at
16,777,216 px, so a 12×16in @300 DPI print file (17.2M px) comes back blank. The
studio clamps DPI rather than shipping an empty file — the real fix is to render the
print file server side from the design JSON now that `/designs` stores the scene.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | shared watch + api watch + web dev |
| `npm run build` | shared → api → web |
| `npm run typecheck` · `npm test` | across all workspaces |
| `npm run db:up` / `db:down` | Postgres container |
| `npm run db:migrate` / `db:deploy` / `db:reset` / `db:seed` / `db:studio` | Prisma |

## Not built yet

Payments, real auth (the admin key is a placeholder), server-side print-file
rendering, POD partner integration, object storage for design previews (they are
stored as data-urls today).
