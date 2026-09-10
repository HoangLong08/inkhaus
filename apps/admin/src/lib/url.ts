/**
 * Links that change one thing about the current list and keep the rest.
 *
 * Every URL-driven control - status filters, sort headers, page sizes, the
 * pager - builds its href here, from the page's zod-PARSED params. That is what
 * fixed the status filter dropping the search box's `q`: each control used to
 * assemble its own query string from the one or two keys it knew about.
 *
 * FROZEN after Phase 0.
 */

export type ParamValue = string | number | boolean | null | undefined;
export type Params = Record<string, ParamValue>;

/**
 * `base?…` from `params` with `changes` applied on top.
 *
 * - An empty value (`undefined`, `null`, `""`) removes its key.
 * - `page` is dropped unless `changes` sets it: a different filter, sort or
 *   page size is a different result set, and page 7 of the old one reads as
 *   "nothing matched".
 * - Page 1 is never written - `/orders` and `/orders?page=1` are one page.
 */
export function hrefWith(base: string, params: Params = {}, changes: Params = {}) {
  const merged: Params = { ...params, page: undefined, ...changes };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
