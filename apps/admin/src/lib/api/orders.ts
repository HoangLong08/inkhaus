import { adminOrderListSchema } from "@/lib/schemas/api";
import type { OrdersQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

/**
 * The page's parsed params, or any subset of them. `limit` is left open on
 * purpose: the URL only ever offers the page sizes, but a server component can
 * ask for exactly what it shows - the overview's latest-orders strip wants 8.
 */
export type OrdersListParams = Omit<Partial<OrdersQuery>, "limit"> & { limit?: number };

export const ordersApi = {
  /** `GET /admin/orders` - free-text `q` over number, email and names */
  list: (params: OrdersListParams = {}) =>
    request(`/admin/orders${query(params)}`, { schema: adminOrderListSchema }),
};
