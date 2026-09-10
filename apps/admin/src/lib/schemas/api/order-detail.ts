/**
 * `GET /admin/orders/:number` - the admin order detail: customer id, per-size
 * pricing, design refs, tracking, and a timeline with internal notes and actors.
 *
 * Empty until the order-detail workstream fills it in. Prefix every export
 * (`adminOrderDetail…`) - `index.ts` re-exports every file here with
 * `export *`, so a name two files share fails typecheck.
 */
export {};
