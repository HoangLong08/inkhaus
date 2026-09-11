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
  /** `GET /admin/orders` - free-text `q` over number, email and names */
  list: (params: OrdersListParams = {}) =>
    request(`/admin/orders${query(params)}`, { schema: adminOrderListSchema }),

  /**
   * `GET /admin/exports/orders.csv`, as the upstream Response with its body
   * unread - the export route handler streams it straight on. The filter keys
   * are picked by name: handed the page's whole params, `page` and `limit`
   * would reach an endpoint that refuses both.
   */
  exportCsv: ({ q, status, from, to, sort }: OrdersExportParams = {}) =>
    requestRaw(`/admin/exports/orders.csv${query({ q, status, from, to, sort })}`),
};
