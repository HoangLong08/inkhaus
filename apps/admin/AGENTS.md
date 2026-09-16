<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# INKHAUS back office — house rules

A staff tool on its own origin (`:4322`), separate from the storefront. Never
indexed, never installable, no service worker, no image optimizer. Density and
legibility beat character.

Everything below is enforced by review and by `apps/admin/e2e`. If a rule gets in
your way, change the rule here in the same commit — do not work around it.

## 1. The UI is shadcn/ui. There are no hand-rolled widgets.

- **Never write a bespoke Tailwind widget.** No `<div className="rounded-lg
  border bg-card p-4">` standing in for a `Card`, no `<span className="rounded-
  full border px-2 py-1">` standing in for a `Badge`, no hand-built dropdown,
  dialog, tooltip, toast or select. If shadcn has it, use it. If it does not,
  compose it from shadcn primitives.
- **Add components with the CLI, one at a time**, from `apps/admin`:
  `npx shadcn@latest add <name>`. Never hand-copy a component off the website and
  never `npm install @radix-ui/*` yourself — the CLI installs the exact primitive
  version the component was generated against. Never pass `--overwrite` as a
  side effect of adding something else.
- **`src/components/ui/*` and `src/hooks/use-mobile.ts` are generated code.**
  `shadcn add` rewrites them verbatim, so they are excluded from lint in
  `eslint.config.mjs`. Style through `className` at the call site or through the
  CSS variables in `globals.css`. If a file genuinely must be forked, put an
  `// INKHAUS:` comment on **every** changed line saying why, so the next
  `shadcn add --overwrite` is a conscious decision rather than a surprise.
  There is exactly **one** sanctioned fork today:
  - `ui/sidebar.tsx` — the `sidebar_state` cookie is written with an explicit
    `SameSite=Lax`.
- **`cn` comes from the `cn` package**, not from a local util: the shadcn
  registry moved it out of `lib/utils.ts` into `github.com/shadcn-ui/cn`, and
  every generated file imports it `from "cn"`. `src/lib/utils.ts` re-exports it
  so the `components.json` alias still resolves; either import reaches the same
  function. Do not reintroduce `clsx` + `tailwind-merge` as direct dependencies.
- **Icons come only from `lucide-react`.** Size them `size-4` / `size-5`, never
  `w-4 h-4`.
- **Your own components live in `src/components/<area>/`** in PascalCase
  (`orders/OrderStatusForm.tsx`, `nav/NavUser.tsx`). Lowercase-kebab is reserved
  for `ui/*`, so a generated file is recognisable at a glance. A plain module
  that is not a component (`nav/nav-config.ts`) is lowercase.
- **List controls are shared, not rebuilt per page.** `components/common/` has
  `ListPage`, `ListHeader`, `TableCard`, `ListFooter`, `UrlSearchBox`,
  `FilterLinks`, `SortableHead`, `PageSizeLinks`, `DateRangePicker` and
  `OwnersOnly`; `Pager` and `StatusBadge` sit one level up.
  Every one of them takes the page's zod-parsed params and builds its links with
  `hrefWith()` from `src/lib/url.ts`: keep every other param, drop `page`. A
  control that assembles its own query string from the one key it knows about is
  how the status chips used to throw away the search.
- **A list page owns the viewport, and `ListPage` is how.** It is
  `calc(100svh - var(--app-header-h))`, a flex column, `gap-2`, with the shell's
  `px-4 py-8 md:px-8` cancelled by negative margins and a `p-3` gutter of its own.
  Every child keeps its natural height except the `TableCard`, which **must**
  carry `fill` — without it the table is only as tall as its rows and the footer
  strands halfway up the screen. Do not reach for `min-h-0` on `(dash)`'s shared
  `<main>` to get the same effect: `SidebarProvider` is `min-h-svh`, a floor
  rather than a height, so collapsing main's min-content contribution stops the
  provider growing and **clips** the twelve non-list pages instead of scrolling
  them. `/customers/[id]` is deliberately not a `ListPage`: its tables sit in
  `Tabs` inside a `lg:grid-cols-[2fr_1fr]`, and locking the page fights that grid.
- **A list's table lives in `TableCard`, and that is where its density lives.**
  `ui/table.tsx` is generated and has 19 importers - the packing slip, the tier
  editor, the overview's tables - so its `th { h-10 px-2 }` and `td { p-2 }` are
  not the place to restyle one list. `TableCard` pushes a `text-xs` scale,
  `h-9 px-3` tinted headers, `h-9` rows with `px-3 py-0` cells, a rule on every
  cell and a zebra stripe down through descendant variants that outrank the
  primitive's own utilities by specificity, inside the same `@layer utilities`.
  The stripe is written `:not(:hover):not([data-state=selected])` so that
  `TableRow`'s own hover and selected colours still win - a plain
  `nth-child(even)` would outrank both. A cell that needs its own vertical
  padding - a two-line cell, a clamped review body - **states it**, and
  `[&_tbody_td:not([class*='py-'])]` steps aside for it; a cell that says nothing
  gets `py-0` and a 36px row. `ListFooter` sits **below** the card, not inside it;
  the `footer` slot is for a rail that genuinely belongs inside the border.
- **`fill` is what makes a `TableCard` work inside a `ListPage`**, and it is
  mandatory there. It gives the card `min-h-0 flex-1` and pushes the same down
  onto the primitive's own `[data-slot=table-container]`, which is the box that
  scrolls. That div is reached by a child-combinator variant, (0,2,0), because
  `ui/table.tsx` is generated and takes no `containerClassName`; `>` rather than
  `_` so a table nested in a cell is not caught. `min-h-0` on **both** levels is
  the whole trick - a column flex item's automatic minimum is its min-content
  height, so without it a 100-row table refuses to shrink and pushes the footer
  off the screen. `overflow-hidden` stays on the card and does **not** break the
  sticky header: sticky resolves against the nearest scroll container, which is
  that inner div, and the header never leaves it. What the clip does is keep the
  table's square corners inside the radius.
- **The sticky header's bottom rule is an inset shadow, on the `<th>`.** Tailwind
  preflight sets `border-collapse: collapse`, so a collapsed border belongs to the
  table's border grid rather than to the cell, and `TableHeader`'s `[&_tr]:border-b`
  stays behind the instant the header scrolls. A shadow is painted by the box that
  moves. It is on the cell and not on the `<thead>` because a `table-header-group`
  is neither a reliable `position: sticky` box in older engines nor a reliable
  `box-shadow` box under `border-collapse`.
- **A table has a stretched row link or a sticky actions column, never both.** The
  row link is a real `<a>` whose `::after` is `absolute inset-0` over a `relative`
  `<tr>` (`OrdersTable`, `CustomersTable`, the quotes and catalog lists). A
  `sticky` cell is positioned, creates a stacking context and must carry an opaque
  background, so it paints over that `::after` and swallows every click in it. For
  the same reason the **first** column is never sticky: `inset-0` resolves against
  the nearest positioned ancestor, so pinning that cell shrinks the row's link down
  to it. A list that wants both puts "Open" in the actions menu instead.

## 2. Colour, density and type all come from the token map.

`src/app/globals.css` is the single source of truth, in five parts: the INKHAUS
ramp in `@theme` (`ink`/`ink-2`/`ink-3`, `paper`/`paper-2`/`paper-3`, `line`,
`acid`, `flame`, `sky`, `moss`, `amber`), the shadcn roles aliased onto it in
`:root` and `.dark`, `@theme inline` wiring the two together, the **root
font-size ladder**, and an `@layer base` block holding the focus ring and the
scrollbars. Every oklch in that file is the computed conversion of the hex above
it, not an approximation.

- Prefer the semantic token (`bg-card`, `text-muted-foreground`, `border`) in new
  code. The raw ramp names still work and older code uses them; both resolve to
  the same colours, but only the semantic ones follow the theme into dark mode.
- **Never add a hex literal in a component.** Add or reuse a `@theme` variable.
- **Never introduce a Tailwind colour outside the ramp** — no `bg-slate-50`, no
  `text-gray-500`, no `border-zinc-200`. The palette is the brand.
- **Chart colours are `--chart-1` … `--chart-5`**, already defined for light and
  dark. In a `ChartConfig` write `color: "var(--chart-1)"` and let `ui/chart.tsx`
  expose it as `var(--color-<key>)` to the series. A hex in a chart is still a hex.
- The one legitimate inline colour is product data:
  `style={{ background: item.color.hex }}` on a swatch — an order line's, or a
  catalog colour's own in the colours table, the colour dialog and the product
  form.
- `acid` is an accent, not a surface. It is the brand chip in the sidebar and the
  selection highlight, and it is `--primary` in dark mode. It is never a
  background for body text.
- **Colour is never the only signal.** Every status badge spells its status out.
- `@theme inline`, not `@theme`, for the shadcn aliases — otherwise a utility
  freezes the `:root` value and `.dark` does nothing.
- **A translucent token is `color-mix(in oklab, var(--token) N%, transparent)`.**
  Never `hsl(var(--token) / N)`: these tokens are complete oklch colours, not the
  bare HSL channel triplets that idiom assumes, so the `hsl()` form parses to
  nothing and the declaration is dropped **silently** — a green build, a rule
  that does nothing, and a UA default in its place. `color-mix` is also what
  Tailwind v4 emits for its own `/30` modifiers, so hand-written CSS and
  `bg-muted/30` agree by construction rather than by eye.

**The root font-size ladder is the app's density knob**, and it is the reason a
`h-9` row measures 31.5px on a laptop rather than 36:

```css
@media screen and (min-width: 1024px) { :root { font-size: 87.5%; } }   /* 14px */
@media screen and (min-width: 1920px) { :root { font-size: 93.75%; } }  /* 15px */
@media screen and (min-width: 2400px) { :root { font-size: 100%; } }    /* 16px */
```

- **Every length in a component is `rem`.** That is the only reason one rule can
  move type, control heights, gaps, padding and the radius ramp together. A `px`
  literal in a `className` is a thing that will not scale with the rest, and it
  will look wrong at exactly one of the three steps. The two sanctioned
  exceptions are a hairline `border` and `ring-[3px]`: a focus ring that thins
  out with the density is a focus ring that stops being seen.
- `--radius-sm` and `--radius-md` are `calc(var(--radius) - 4px)` and `- 2px`, a
  rem/px mix the ladder shrinks on one side only. Keep `--radius` at or above
  ~0.3rem or `--radius-sm` goes negative and CSS clamps it to 0.
- **`screen` is not optional.** `(print)`'s packing slip has no `@media print`
  block of its own — it uses Tailwind `print:*` variants, which compile into
  one — so a `screen`-scoped query does not match while printing and `:root`
  falls back to 100%. Drop the keyword and every slip prints 12.5% small.
- Media Queries L4 §1.3 evaluates units in a media query against the *initial*
  font size, so Tailwind's rem breakpoints stay pinned at 640/768/1024/1280/1536
  CSS px. There is no feedback loop, and `hooks/use-mobile.ts`'s px `matchMedia`
  is unaffected either way.
- **`--app-header-h` is the one place the app header's height is written.**
  `(dash)/layout.tsx` sets the header with `h-(--app-header-h)` and
  `common/ListPage.tsx` subtracts it from `100svh`. Neither may hard-code 3.5rem.

**The type is Inter and JetBrains Mono, loaded with `next/font/google`** in
`app/layout.tsx` and wired into `--font-sans` / `--font-mono` in `@theme`, so
every `font-sans` and `font-mono` already written picks them up.

- `next/font` fetches at **build** time and self-hosts the woff2 out of
  `/_next/static`, which is the only reason a webfont does not violate §5. A
  `<link rel="stylesheet">` to a font CDN — or a `@import url(...)` in
  `globals.css` — is a runtime request to a third party. Never add one.
- It is a build-time API, not a component, so nothing in the root layout becomes
  a client component and `/login` keeps its no-`Providers` tree.
- The system stack stays behind each face as the fallback. Do not remove it: it
  is what a build with no network renders.
- `body` sets `font-feature-settings: "cv11", "ss01"` and nothing else. Naming
  only those two leaves `font-variant-numeric` alone, so `tabular-nums` still
  aligns every money column. Do not add `'opsz'` — pinning Inter's optical size
  gives 10.5px table text display-weight hairlines.

## 3. zod at four boundaries. No exceptions.

Schemas live in `src/lib/schemas/{api,params,forms}/`, one file per feature, and
are shared between the form that collects a value, the route handler that
receives it, and the parser that reads it back. A schema written twice is a
schema that drifts.

- **Import from the folder** (`@/lib/schemas/api`), never from a feature file.
  Each `index.ts` is `export *` of every file beside it, so a name two files
  export is a typecheck error rather than a silent shadow — which is why every
  export carries its feature's prefix (`adminOrderListItemSchema`,
  `statsOverviewSchema`).
- `schemas/api/core.ts` is the shared vocabulary (status and role enums,
  pagination, user, session); `schemas/params/common.ts` has the URL building
  blocks (`pageParam`, `limitParam` — 20/50/100 only — `isoDayParam`,
  `searchParam`). Compose them; never redefine them.

1. **`searchParams`** — parse before use, with `.catch()` outermost so a
   hand-typed URL degrades instead of 500ing. `ordersQuerySchema.parse()` cannot
   throw, which is why pages call it with no try/catch. Never
   `params.status as OrderStatus`: a cast is not a check. Dates in a URL are
   `from`/`to` as UTC `YYYY-MM-DD`, both inclusive.
2. **Form input** — `useForm({ resolver: zodResolver(schema) })`, always, even
   for one field. The resolver is what wires messages into `<FormMessage />`.
   Length limits are the shared constants the API validates with
   (`ORDER_NOTE_MAX`, `CATALOG_LIMITS`), never a number typed twice — the note
   limit was 500 here and 300 in the API.
3. **Route-handler input** — every handler under `src/app/api/admin/*` parses its
   segments, query and body with a schema. The client is not trusted, including
   our own. A segment is parsed before it is interpolated into an upstream path
   (`quoteIdSchema`, `productSlugParamSchema`, `sizeCodeParamSchema`, …) —
   `encodeURIComponent("..")` is still `..` — and a page answers a bad one with
   `notFound()`, a handler with 400. A body is read as
   `request.json().catch(() => null)`, so bytes that are not JSON are the
   schema's 400, not a 500.
4. **API responses** — `src/lib/api/` parses what the NestJS API returns before
   handing it to a page, and `src/lib/client-api/` does the same for the BFF.
   The API is a separate deployment on its own release cadence;
   `res.json() as Promise<T>` is a claim nothing verifies. Response schemas are
   plain `z.object`s: an unknown key is stripped, not rejected, so the API can
   add a field before the admin reads it. A field the API added later is
   `.optional()` until every deployed API sends it.

Enum values come from `@inkhaus/shared/orders` (`ORDER_STATUSES`,
`QUOTE_STATUSES`, `ORDER_TRANSITIONS`, `canSetStatus`, `CARRIERS`) and
`@inkhaus/shared/admin` (`REVIEW_STATUSES`, `ADMIN_CAPABILITIES`, `can`). Always a
subpath — the package root drags the whole catalog into a client bundle. Do not
retype a status list — there used to be three copies of `OrderStatus` in this
app and they drifted. The exported TS types (`Order`, `AdminUser`, …) are
`z.infer` of those schemas and are re-exported from `@/lib/api`; add a field to
the schema, not to a type.

## 4. Data: server by default, TanStack Query in the browser.

**Server Components fetch with `adminApi` from `@/lib/api`.** That folder is
`server-only`; it reads the session cookie and calls the API with the caller's
own token. A page whose content is a pure function of the URL — the orders list,
the quotes list, the overview — stays fully server-rendered. Do not turn a page
into a client component to add a spinner.

**The data layer is one folder per concern and one file per feature.** Import
paths never change (`@/lib/api`, `@/lib/client-api`, `@/lib/query-keys`, …);
`index.ts` composes the files beside it. The `index.ts` and `core.ts` files are
**frozen** — a contract every workstream builds on, changed only in a commit of
its own. A feature grows by editing its own file, which `index.ts` already
mounts.

| folder | frozen | per feature |
|---|---|---|
| `lib/api/` — `adminApi` | `index.ts`, `core.ts` (`request`, `requestRaw`, `query`), `auth.ts`, `lookups.ts` | `orders.ts` (the list), `order.ts` (one order), `quotes.ts`, `customers.ts`, `catalog.ts`, `reviews.ts`, `staff.ts`, `stats.ts` |
| `lib/client-api/` — `clientApi` | `index.ts`, `core.ts` (`call`, `json`, `query`) | `order.ts`, `quotes.ts`, `customers.ts`, `catalog.ts`, `reviews.ts`, `staff.ts` |
| `lib/schemas/api/` | `index.ts`, `core.ts`, `lookups.ts`, `orders.ts` (the legacy order) | `orders-list.ts`, `order-detail.ts`, `quotes.ts`, `customers.ts`, `catalog.ts`, `reviews.ts`, `staff.ts`, `stats.ts` |
| `lib/schemas/params/` | `index.ts`, `common.ts` | one per feature |
| `lib/schemas/forms/` | `index.ts` | one per feature |
| `lib/query-keys/` — `queryKeys` | `index.ts` | one per feature |
| `lib/mutations/` | `index.ts` | one per feature |

Also frozen: `lib/{api-guard,api-response,dal,format,session,query-client,url}.ts`,
`components/{common,nav,providers,ui}/**`, `StatusBadge`, `StatusFilterLinks`,
`Pager`, `skeletons` (use `TableSkeleton` with your own columns).

- `adminApi.lookups` (`staffDirectory`, `catalogOptions`) is shared reference
  data. Read it from there; do not add a second copy to a feature file.
- `requestRaw(path)` returns the upstream `Response` unread, for a body that must
  stream rather than parse — an export, an image. A non-2xx still throws
  `ApiError`. Forward the body and the headers you mean to send, never the
  upstream headers wholesale.

**Anything that fetches in the browser goes through TanStack Query.** No bare
`fetch` in a `useEffect`, no `useState` + `useEffect` data loading, ever.

- **Query keys come from `@/lib/query-keys`. Never write one inline** — an
  inline key is an `invalidateQueries` that silently does nothing. Every key the
  back office needs is already declared; a feature changes the params type its
  key takes in its own file.
- **The key's params object must be the zod-parsed one on both sides.** The page
  parses `searchParams`, builds the key from the result, and passes that same
  object down as a prop. Hand-assembled params are the usual cause of
  "prefetched, then immediately refetched".
- **Server prefetch, then hydrate.** `fetchQuery` into `getQueryClient()`, wrap
  the subtree in `<HydrationBoundary state={dehydrate(qc)}>`, and the client leaf
  reads the same key with `useQuery`. One network call, no waterfall, no loading
  flash. Do not pass the same object down as `initialData` as well — that
  serialises it into the payload a second time per leaf.
- **Keep client leaves small.** The order detail page is server-rendered except
  for the few leaves that change from that screen, and they share one cache
  entry.
- `staleTime` is 30s and `refetchOnWindowFocus` is on, set in `query-client.ts`.
  Hydrated data must not refetch on mount.
- **Dates print in UTC.** `at()` and `on()` from `lib/format` format in UTC, the
  zone the API buckets days in (D8), and `at()` says so ("Sep 5, 2026, 11:30 PM
  UTC"). Never format a date in the machine's zone — `toLocaleString()`, an
  `Intl.DateTimeFormat` without `timeZone: "UTC"`: the server and the browser
  print different strings, which is a hydration error, and a UTC day lands on
  the day before west of Greenwich. `suppressHydrationWarning` hides that; it
  does not fix it. `relative()` in a client component takes a `now` both renders
  share (the query's `dataUpdatedAt`).
- **Every write is a `useMutation`** with `onMutate` (optimistic), `onError`
  (rollback, then `toast.error` — but stay silent on a 401, which has already
  redirected), `onSuccess` (`setQueryData` + `toast.success`), and `onSettled`
  (`invalidateQueries`, plus `router.refresh()` when server-rendered markup on
  the same page depends on the value).
- **Errors are toasts, not URL state.** There is no `?error=` idiom in this app
  any more. Do not reintroduce redirect-with-an-error-query-param.
- **Server Actions are down to one: `logout()`.** The status writes moved to
  route handlers because their controls are Radix Selects, which submit nothing
  with JavaScript off — a "fallback" action nothing could reach would be a second
  authorization path no test covers.

## 5. The BFF rule: the browser never talks to the API.

`API_INTERNAL_URL` is reachable only from the Next server. The session token is
an HttpOnly cookie and stays that way.

- Client queries and mutations call **same-origin route handlers** under
  `src/app/api/admin/*`, through `@/lib/client-api` — `client-api/core.ts` is
  the only module in this app that may call `fetch` from a browser, and every
  path it uses is relative.
- **Never** put an API URL in a client component, and never expose one through
  `NEXT_PUBLIC_*`.
- **A same-origin download link or image is allowed**, and is the right tool for
  a body that is not JSON: `<a href="/api/admin/exports/orders?…">` or
  `<img src="/api/admin/designs/…/preview/front">`. The browser sends the cookie
  to our own origin, the route handler checks the capability and streams the
  body through with `requestRaw`. The `<img>` trips `@next/next/no-img-element`;
  disable it on that line with the reason (`-- same-origin BFF image; this app
  runs no image optimizer`). Never point either at the API's origin.
- Every BFF handler starts with `await requireCapability(action)` from
  `src/lib/api-guard.ts` — or `requireAdminApi()` for `/me`, which is about the
  session itself — **not** `requireAdmin()`. The latter calls `redirect()`,
  which in a Route Handler is a 307 to an HTML page; `fetch` follows it and
  reports a 200 with a login document in the body. `proxy.ts` answers `/api/*`
  with a 401 for the same reason.
- Wrap every handler in `route()` from `src/lib/api-response.ts` so a throw
  becomes JSON with a sane status instead of Next's HTML error page. It never
  leaks a stack trace or the API's address.
- **A write is same-origin JSON, or it is refused.** The session cookie is
  SameSite=Lax, which does not stop a page on the same *site* — the storefront,
  any subdomain — from posting a hidden `enctype="text/plain"` form here with
  the cookie attached. So `proxy.ts` refuses every non-GET/HEAD request under
  `/api/admin/*` whose `Sec-Fetch-Site` is not `same-origin` or, without that
  header, whose `Origin` is not this app's (403); and every POST/PUT/PATCH whose
  `content-type` is not `application/json` (415) — a page cannot send JSON
  cross-origin without a preflight. Refusals are JSON `{ error }`, never a
  redirect. A request with neither header is not a browser, holds no ambient
  cookie, and passes. `/api/auth/google/*` is outside the rule.
  `e2e/security.spec.ts` covers it.
- The authorization rule for a write lives in `src/lib/mutations/<feature>.ts`,
  apart from the transport, so a second caller cannot reimplement it
  differently.
- **Permissions are one table, enforced three times, and all three are
  load-bearing.** `ADMIN_CAPABILITIES` and `can(role, action)` in
  `@inkhaus/shared/admin` are the only source. The UI hides what you may not do
  with `can()` (the nav filters on it, controls disable on it); the route handler
  refuses it with `requireCapability(action)` → 403; the API refuses it again
  with `@Can(action)`. Removing any one of them is a security change, not a
  refactor. `canSetStatus` stays as the value-level rule for order statuses —
  cancelling shares an endpoint with every other move, so no route-level
  capability can express it — and is checked in `mutations/orders.ts`.
- **A page a role may not see renders `<OwnersOnly title="…" />`** — the page's
  own `<h1>` and an `Empty` explaining why, `data-testid="owners-only"`. Never
  redirect away and never add a `?error=`; there is no `requireOwner()`. Check
  `can(user.role, action)` against `await requireAdmin()` in the page.

`e2e/auth.spec.ts` asserts the browser makes **zero** requests to the API origin
across a sign-in and seven navigations, including an order, a quote, a product
and a customer profile — pages whose client leaves run queries. Any direct call
fails the suite, and that is the point.

## 6. Accessibility and test hooks — the e2e contract.

`apps/admin/e2e` drives a real browser through a real OAuth flow. These
conventions are what keep it from being rewritten every time the UI moves.

- **Every interactive control gets a `data-testid`.** Tests must never match on
  visible copy, because copy is the thing designers change. The contract — ids
  asserted today and ids reserved for the screens being built:

  | area | ids |
  |---|---|
  | login | `google-form`, `google-signin`, `login-error` |
  | chrome | `user-menu`, `current-user`, `sign-out`, `sign-out-dialog`, `sign-out-{confirm,cancel}`, `sidebar-toggle`, `breadcrumb-current`, `breadcrumb-link`, `theme-toggle`, `theme-{light,dark,system}`, `nav-link` (data-section), `nav-expand` (data-section), `nav-sub-link` (data-section, data-value), `owners-only` |
  | shared | `status-badge` (data-status), `status-filter` (data-status, data-count), `pager`, `pager-{first,previous,page,next,last}`, `pager-count` (data-page, data-pages), `list-page`, `list-footer`, `list-range` (data-from, data-to, data-total), `filter-link` (data-param, data-value), `sort-head` (data-sort, data-active), `page-size` (data-limit), `{prefix}-date-{trigger,apply,clear,preset}` |
  | overview | `stat-tile` (data-status, data-count), `recent-order` (data-number), `recent-orders-all`, `range-link` (data-range), `revenue-total` (data-value), `revenue-chart` (data-empty), `series-table`, `top-product` (data-slug), `quote-funnel` (data-created), `attention-item` (data-kind, data-id, data-email, data-number) |
  | orders | `orders-meta`, `orders-search`, `orders-search-clear`, `orders-columns`, `orders-column` (data-column, data-visible), `order-row` (data-number, data-status, data-total), `order-row-link`, `order-customer-link` (data-customer-id), `orders-export` (data-capped), `orders-export-capped`, `orders-empty` (data-reason), `orders-empty-action` |
  | order detail | `status-select`, `status-option` (data-status), `status-note`, `status-save`, `no-moves`, `order-timeline`, `status-confirm-dialog`, `status-confirm`, `status-confirm-cancel`, `status-tracking-carrier`, `status-tracking-carrier-option` (data-carrier), `status-tracking-number`, `tracking-carrier`, `tracking-carrier-option` (data-carrier), `tracking-number`, `tracking-save`, `tracking-link`, `order-note-input`, `order-note-save`, `timeline-event` (data-kind, data-status), `timeline-actor`, `timeline-tracking-link`, `customer-link`, `design-preview` (data-design, data-side), `quote-origin-link`, `packing-slip-link`, `packing-slip`, `packing-slip-print`, `packing-slip-back`, `order-back`, `order-not-found-back`, `packing-slip-not-found-back` |
  | quotes | `quotes-meta`, `quotes-search`, `quotes-search-clear`, `quote-row` (data-id, data-status, data-overdue), `quote-row-link`, `quote-select` (data-status), `quote-option` (data-status), `quote-back`, `quote-not-found-back`, `quote-email`, `quote-assignee-select` (data-assignee), `quote-assignee-option` (data-id, data-self), `quote-follow-up-trigger` (data-day), `quote-follow-up-day` (data-day, data-today), `quote-follow-up-clear`, `quote-note-input`, `quote-note-save`, `quote-timeline`, `quote-event` (data-kind, data-pending), `quote-event-order`, `quote-convert-open`, `quote-convert-dialog`, `convert-product` (data-slug), `convert-product-search`, `convert-product-option` (data-slug), `convert-color` (data-slug), `convert-color-option` (data-slug), `convert-method` (data-method), `convert-method-option` (data-method), `convert-size-qty` (data-size), `convert-estimate` (data-units, data-total), `convert-notes`, `convert-cancel`, `convert-submit`, `quote-order-link` (data-number), `quote-customer-link` |
  | customers | `customers-meta`, `customers-search`, `customers-search-clear`, `customer-row` (data-id, data-email), `customer-row-link`, `customer-back`, `customer-not-found-back`, `customer-profile`, `customer-edit-open`, `customer-edit-dialog`, `customer-{name,phone,company,note}`, `customer-save`, `customer-edit-cancel`, `customer-stat` (data-stat, data-value), `customer-tab` (data-tab), `customer-order-row` (data-number, data-status), `customer-orders-all`, `customer-quote-row` (data-id, data-status), `customer-design` (data-design) |
  | catalog | `products-meta`, `products-search`, `products-search-clear`, `product-row` (data-slug, data-active), `product-row-link`, `product-back`, `product-not-found-back`, `product-new`, `product-{name,slug,type,category,blurb,fabric,tag,price,bulk-price,sort-order,active,save}`, `product-type-option` (data-type), `product-category-option` (data-category), `product-method` (data-method), `product-size` (data-size), `product-color` (data-color), `product-print-{x,y,w,h}`, `product-inches-{w,h}`, `product-history`, `product-history-entry` (data-action), `color-row` (data-slug, data-active), `color-{new,edit,name,slug,hex,dark,sort-order,active,save,cancel}`, `size-row` (data-code, data-built-in), `size-{new,edit,code,label,upcharge,sort-order,save,cancel,delete,delete-confirm,delete-cancel}`, `tier-row` (data-min), `tier-{min,off,add,remove}`, `tiers-save`, `tiers-error`, `tiers-preview`, `tiers-sample`, `tiers-sample-option` (data-slug), `price-sync-warning` |
  | reviews | `reviews-meta`, `reviews-search`, `reviews-search-clear`, `review-row` (data-id, data-status, data-rating), `review-select`, `review-select-all`, `review-actions`, `review-{publish,reject,pending,delete}`, `review-delete-dialog`, `review-delete-{confirm,cancel}`, `bulk-publish`, `bulk-reject`; the status chips are the shared `status-filter` |
  | staff | `staff-row` (data-email, data-role, data-active, data-self), `staff-invite-{open,dialog,email,name,role,role-option,submit}`, `staff-role-select`, `staff-role-option` (data-role), `staff-active`, `staff-deactivate-dialog`, `staff-deactivate-{confirm,cancel}`, `staff-revoke-sessions`, `staff-revoke-dialog`, `staff-revoke-{confirm,cancel}` |
  | errors | `segment-error`, `segment-error-retry` |

  Renaming or removing one is a change to `apps/admin/e2e` in the **same commit**.
  A new interactive control means a new id, added to this table in the commit
  whose spec first uses it.
- A few ids need their shape spelled out. `filter-link` also mirrors its value
  onto `data-<param>` (which is how `status-filter` keeps `data-status`) and uses
  `ALL` for the link that clears the filter. `sort-head` is the link inside the
  `<th>`; `aria-sort` sits on the `<th>` itself. `nav-sub-link`'s `data-value` is
  the status code for a filter child, `mine` for "Mine", and
  `products` / `colors` / `sizes` / `pricing` in the catalog.
  `{prefix}-date-trigger` carries the applied range as `data-from` / `data-to`;
  a preset applies at once and carries `data-days`. `nav-expand` is the chevron
  beside a section that has children. `series-table` has one body row per day,
  its UTC day on `data-date` (`YYYY-MM-DD`); `stat-tile`'s `data-count`,
  `revenue-total`'s and `customer-stat`'s `data-value` are the raw numbers the
  label formats. A customer profile's values carry `data-field` (the Google row
  also `data-linked`).
- The list footer's ids. `list-range` is the "Showing 1–20 of 134" line, with the
  three raw numbers on `data-from` / `data-to` / `data-total` so nothing has to
  parse an en dash. `pager-first` and `pager-last` are omitted - not disabled -
  when you are already on that page, the way `pager-previous` and `pager-next`
  always have been: a disabled `<a>` is not a thing. `pager-count` ("Page 3 of 7",
  `data-page` / `data-pages`) only exists in the pager's `compact` form, and in
  that form `pager-page` is absent - the number window is what it replaces.
  `orders-meta` is still the page's **total**, and `e2e/overview.spec.ts` reads the
  first number out of it to check a stat tile; `list-range` is a second fact, not a
  rewrite of that one.
- On `/orders` the status filter **is** the queue strip: its segments carry
  `status-filter`, `data-status` and `aria-current` exactly as the chip row did,
  plus `data-count` with the queue's size. Those counts are all-time, like the
  overview's tiles - they do not narrow with `q` or a date range, and are not meant
  to agree with the row count below them.
- **Machine-readable values go on a `data-*` attribute, not in the label** —
  `data-status="PENDING_PAYMENT"` beside the text "Pending payment", so a test
  never has to know about `humanize()`.
- **Radix portals its overlays.** `Select`, `DropdownMenu`, `Dialog`, `Tooltip`
  and `Popover` render into a portal that does not exist until the trigger is
  activated, and a `SelectItem` is `[role="option"]`, not an `<option>`. A test
  that needs the contents must open the control first — `e2e/helpers.ts` has
  `signOut(page)` and `allowedTransitions(page)` for exactly this. Add a helper
  rather than repeating the open-read-escape dance.
- **Every page keeps an `<h1>`** — a `not-found.tsx` and an `error.tsx` too, since
  each stands in for a whole page. A breadcrumb is not a heading;
  `BreadcrumbPage` renders `role="link" aria-current="page"`. `ListHeader` and
  `OwnersOnly` both render one, which is most of the reason they exist.
- **Link-based filters keep `aria-current="page"`.** Do not replace them with
  `Tabs` or `ToggleGroup`: those are client-only, lose the deep link that the
  overview tiles navigate through, and lose `aria-current`. Filter state belongs
  in the URL. `Tabs` is for switching content on a detail page (a customer's
  orders / quotes / designs), never for filtering a list.
- **`/login` must render and function with JavaScript disabled, and must contain
  exactly one `<form>`.** No `Providers`, no `<Toaster />`, no `"use client"`
  anywhere in its tree. Every shadcn component it uses is plain markup or a Slot.
  This is why `Providers` is mounted in `(dash)/layout.tsx` and only
  `ThemeProvider` — which fetches nothing — sits in the root layout.
- Form controls are labelled through `<FormLabel>` / `<FormField>`, which wires
  `htmlFor`, `aria-describedby` and `aria-invalid` for you. A bare `<Input>` with
  a placeholder for a label is a bug.

## 7. Next.js 16 specifics for this app.

Read `node_modules/next/dist/docs/` before writing framework code — the managed
block above is not a formality.

- `export const dynamic = "force-dynamic"` in `src/app/(dash)/layout.tsx` is
  **load-bearing**: without it the same URL was served from cache, including
  after the session had been revoked. It is also what makes `NavMain`'s
  `useSearchParams()` safe without a Suspense boundary. Do not remove it, and do
  not enable `cacheComponents` — that deletes the export entirely.
- **`error.tsx` receives `retry`, not `reset`** (stable as of 16.3). `reset`
  re-renders without re-fetching, which for a page that *is* a fetch means
  landing straight back on the error.
- **`loading.tsx` does not cover runtime data read in a layout.** Keep
  `(dash)/layout.tsx`'s awaits to `requireAdmin()` and `cookies()`, and fetch page
  data in `page.tsx`, or the skeleton never appears.
- `proxy.ts`, not `middleware.ts`. The middleware convention is deprecated, and
  the `edge` runtime is not available in `proxy`.
- `params` and `searchParams` are Promises — in route handlers as well as pages.
  `await` them, then zod-parse.
- Do not add a PWA, a service worker or the image optimizer here. See
  `next.config.mjs`, which needs no edits for UI work.

## 8. Commands.

```bash
npm run dev -w @inkhaus/admin        # :4322
npm run typecheck -w @inkhaus/admin  # tsc 7
npm run lint -w @inkhaus/admin
npm run build -w @inkhaus/admin
npm run test:e2e:admin               # from the repo root; needs `npm run db:up`
npx shadcn@latest add <component>    # from apps/admin
```

The e2e suite runs against its own build dir (`.next-e2e`) and its own ports, and
reseeds the database. It leaves `next-env.d.ts` pointing at `.next-e2e`; the next
`npm run dev` points it back. **Never commit that file aimed at `.next-e2e`** —
`typecheck` fails on a checkout that has never run the suite.

**The suite's viewport is 1280×720** — `playwright.config.ts` spreads
`devices["Desktop Chrome"]` and overrides nothing. 1280 is above the ladder's
1024 step, so every spec runs at **87.5% / a 14px root**. A test that reasons
about a pixel size must be written against that, not against 16px.

Two things about running it twice:

- **Wait a minute between runs.** `zz-rate-limit.spec.ts` deliberately exhausts
  the sign-in limiter (40/min under test), which is why it is named to sort last.
  A second run started inside that same minute fails on sign-in, and the failures
  surface far from the cause.
- The status tests spend `PENDING_PAYMENT` orders and the transition table has no
  route back, so `prisma/seed-e2e.ts` resets some on every run. A test that needs
  an order to *act on* must use `findActionableOrder`; one that just needs an
  order number should read `data-number` off the list instead, or it fails on
  fixture exhaustion rather than on its own subject.
