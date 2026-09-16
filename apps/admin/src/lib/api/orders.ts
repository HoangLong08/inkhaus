import { adminOrderListSchema } from "@/lib/schemas/api";
import type { OrdersQuery } from "@/lib/schemas/params";

import { query, request, requestRaw } from "./core";

/**
 * The page's parsed params, or any subset of them. `limit` is left open on
 * purpose: the URL only ever offers the page sizes, but a server component can
 * ask for exactly what it shows - the overview's latest-orders strip wants 8.
 * `customerId` narrows to one customer's orders; no URL carries it.
 */
export type OrdersListParams = Omit<Partial<OrdersQuery>, "limit"> & {
  limit?: number;
  customerId?: string;
};

/** what narrows an export: the list's filters and sort, never its paging */
export type OrdersExportParams = Pick<Partial<OrdersQuery>, "q" | "status" | "from" | "to" | "sort">;

export const ordersApi = {
  /**
   * `GET /admin/orders` - free-text `q` over number, email and names.
   *
   * The keys are picked by name, like `exportCsv` below, so a params object that
   * also carries display state cannot leak it upstream: `cols` says which columns
   * the browser draws, the API has no opinion about it, and an endpoint that
   * validates its query would answer an unknown key with a 400.
   */
  list: ({ q, status, from, to, sort, page, limit, customerId }: OrdersListParams = {}) =>
    request(`/admin/orders${query({ q, status, from, to, sort, page, limit, customerId })}`, {
      schema: adminOrderListSchema,
    }),

  /**
   * `GET /admin/exports/orders.csv`, as the upstream Response with its body
   * unread - the export route handler streams it straight on. The filter keys
   * are picked by name: handed the page's whole params, `page` and `limit`
   * would reach an endpoint that refuses both.
   */
  exportCsv: ({ q, status, from, to, sort }: OrdersExportParams = {}) =>
    requestRaw(`/admin/exports/orders.csv${query({ q, status, from, to, sort })}`),
};
