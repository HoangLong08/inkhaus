<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# INKHAUS monorepo

npm workspaces. `apps/web` (storefront, :4321) · `apps/admin` (back office,
:4322) · `apps/api` (NestJS + Prisma + PostgreSQL, :4000, everything under
`/api/v1`) · `packages/shared` (domain types, the price ladder, the order
transition table) · `packages/env` (the one `.env`, at this root) ·
`packages/oidc-stub` (a fake Google, e2e only).

**Read the app-level rules before editing inside an app. They are not optional
and they are deliberately not duplicated here:**

- `apps/admin/AGENTS.md` — shadcn/ui, zod, TanStack Query, the BFF rule, the e2e
  test contract. Everything under `apps/admin/src` is governed by it.
- `apps/web/AGENTS.md` — storefront rules.

`packages/shared` is imported by all three apps and reaches client bundles.
Anything added there must stay dependency-free and browser-safe, and must be
reachable through a subpath export (`@inkhaus/shared/orders`) so a client import
does not drag the whole catalog along with it.

There is one `.env`, and it is at this root — no `apps/*/.env*`. See README.md.
