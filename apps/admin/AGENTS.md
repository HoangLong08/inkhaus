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
  version the component was generated against.
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
  for `ui/*`, so a generated file is recognisable at a glance.

## 2. Colour comes from the token map, never from a raw hex.

`src/app/globals.css` is the single source of truth, in three layers: the INKHAUS
ramp in `@theme` (`ink`/`ink-2`/`ink-3`, `paper`/`paper-2`/`paper-3`, `line`,
`acid`, `flame`, `sky`, `moss`, `amber`), the shadcn roles aliased onto it in
`:root` and `.dark`, and `@theme inline` wiring the two together. Every oklch in
that file is the computed conversion of the hex above it, not an approximation.

- Prefer the semantic token (`bg-card`, `text-muted-foreground`, `border`) in new
  code. The raw ramp names still work and older code uses them; both resolve to
  the same colours, but only the semantic ones follow the theme into dark mode.
- **Never add a hex literal in a component.** Add or reuse a `@theme` variable.
- **Never introduce a Tailwind colour outside the ramp** — no `bg-slate-50`, no
  `text-gray-500`, no `border-zinc-200`. The palette is the brand.
- The one legitimate inline colour is product data:
  `style={{ background: item.color.hex }}` on the swatch in the order detail.
- `acid` is an accent, not a surface. It is the brand chip in the sidebar and the
  selection highlight, and it is `--primary` in dark mode. It is never a
  background for body text.
- **Colour is never the only signal.** Every status badge spells its status out.
- `@theme inline`, not `@theme`, for the shadcn aliases — otherwise a utility
  freezes the `:root` value and `.dark` does nothing.

## 3. zod at four boundaries. No exceptions.

Schemas live in `src/lib/schemas/{api,params,forms}.ts` and are shared between
the form that collects a value, the route handler that receives it, and the
parser that reads it back. A schema written twice is a schema that drifts.

1. **`searchParams`** — parse before use, with `.catch()` outermost so a
   hand-typed URL degrades instead of 500ing. `ordersQuerySchema.parse()` cannot
   throw, which is why pages call it with no try/catch. Never
   `params.status as OrderStatus`: a cast is not a check.
2. **Form input** — `useForm({ resolver: zodResolver(schema) })`, always, even
   for one field. The resolver is what wires messages into `<FormMessage />`.
3. **Route-handler input** — every handler under `src/app/api/admin/*` parses its
   query or body with a schema. The client is not trusted, including our own.
4. **API responses** — `src/lib/api.ts` parses what the NestJS API returns before
   handing it to a page, and `client-api.ts` does the same for the BFF. The API
   is a separate deployment on its own release cadence; `res.json() as Promise<T>`
   is a claim nothing verifies.

Enum values come from `@inkhaus/shared/orders` (`ORDER_STATUSES`,
`QUOTE_STATUSES`, `ORDER_TRANSITIONS`, `canSetStatus`). Do not retype a status
list — there used to be three copies of `OrderStatus` in this app and they
drifted. The exported TS types (`Order`, `AdminUser`, …) are `z.infer` of those
schemas and are re-exported from `api.ts`; add a field to the schema, not to a
type.

## 4. Data: server by default, TanStack Query in the browser.

**Server Components fetch with `adminApi` from `src/lib/api.ts`.** That module is
`server-only`; it reads the session cookie and calls the API with the caller's
own token. A page whose content is a pure function of the URL — the orders list,
the quotes list, the overview — stays fully server-rendered. Do not turn a page
into a client component to add a spinner.

**Anything that fetches in the browser goes through TanStack Query.** No bare
`fetch` in a `useEffect`, no `useState` + `useEffect` data loading, ever.

- **Query keys come from `src/lib/query-keys.ts`. Never write one inline** — an
  inline key is an `invalidateQueries` that silently does nothing.
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
  for three leaves that share one cache entry, because only three regions can
  change from that screen.
- `staleTime` is 30s and `refetchOnWindowFocus` is on, set in `query-client.ts`.
  Hydrated data must not refetch on mount.
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
  `src/app/api/admin/*`, through `src/lib/client-api.ts` — the only module in
  this app that may call `fetch` from a browser, and every path it uses is
  relative.
- **Never** put an API URL in a client component, and never expose one through
  `NEXT_PUBLIC_*`.
- Every BFF handler starts with `await requireAdminApi()` from
  `src/lib/api-guard.ts`, **not** `requireAdmin()`. The latter calls `redirect()`,
  which in a Route Handler is a 307 to an HTML page; `fetch` follows it and
  reports a 200 with a login document in the body. `proxy.ts` answers `/api/*`
  with a 401 for the same reason.
- Wrap every handler in `route()` from `src/lib/api-response.ts` so a throw
  becomes JSON with a sane status instead of Next's HTML error page. It never
  leaks a stack trace or the API's address.
- The authorization rule itself lives in `src/lib/mutations.ts`, apart from the
  transport, so a second caller cannot reimplement it differently.
- **Role rules are enforced in three places and all three are load-bearing:** the
  UI hides what you may not do (`canSetStatus` filtering the transition list),
  the route handler refuses it with a 403, and the API refuses it again with
  `@Roles`. Removing any one of them is a security change, not a refactor.

`e2e/auth.spec.ts` asserts the browser makes **zero** requests to the API origin
across a sign-in and four navigations, including the one page that runs client
queries. Any direct call fails the suite, and that is the point.

## 6. Accessibility and test hooks — the e2e contract.

`apps/admin/e2e` drives a real browser through a real OAuth flow. These
conventions are what keep it from being rewritten every time the UI moves.

- **Every interactive control gets a `data-testid`.** Tests must never match on
  visible copy, because copy is the thing designers change. Currently asserted:

  | area | ids |
  |---|---|
  | login | `google-form`, `google-signin`, `login-error` |
  | chrome | `user-menu`, `current-user`, `sign-out`, `sidebar-toggle`, `breadcrumb-current`, `theme-toggle`, `theme-{light,dark,system}` |
  | shared | `status-badge`, `status-filter`, `pager`, `pager-{previous,page,next}` |
  | overview | `stat-tile`, `recent-order` |
  | orders | `orders-meta`, `orders-search`, `orders-search-clear`, `order-row` |
  | order detail | `status-select`, `status-option`, `status-note`, `status-save`, `no-moves`, `order-timeline` |
  | quotes | `quotes-meta`, `quote-card`, `quote-select`, `quote-option` |
  | errors | `segment-error` |

  Renaming or removing one is a change to `apps/admin/e2e` in the **same commit**.
  A new interactive control means a new id.
- **Machine-readable values go on a `data-*` attribute, not in the label** —
  `data-status="PENDING_PAYMENT"` beside the text "Pending payment", so a test
  never has to know about `humanize()`.
- **Radix portals its overlays.** `Select`, `DropdownMenu`, `Dialog`, `Tooltip`
  and `Popover` render into a portal that does not exist until the trigger is
  activated, and a `SelectItem` is `[role="option"]`, not an `<option>`. A test
  that needs the contents must open the control first — `e2e/helpers.ts` has
  `signOut(page)` and `allowedTransitions(page)` for exactly this. Add a helper
  rather than repeating the open-read-escape dance.
- **Every page keeps an `<h1>`.** A breadcrumb is not a heading; `BreadcrumbPage`
  renders `role="link" aria-current="page"`.
- **Link-based filters keep `aria-current="page"`.** Do not replace them with
  `Tabs` or `ToggleGroup`: those are client-only, lose the deep link that the
  overview tiles navigate through, and lose `aria-current`. Filter state belongs
  in the URL.
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
