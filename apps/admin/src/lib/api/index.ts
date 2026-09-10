import "server-only";

import { authApi } from "./auth";
import { catalogApi } from "./catalog";
import { customersApi } from "./customers";
import { lookupsApi } from "./lookups";
import { orderApi } from "./order";
import { ordersApi } from "./orders";
import { quotesApi } from "./quotes";
import { reviewsApi } from "./reviews";
import { staffApi } from "./staff";
import { statsApi } from "./stats";

/**
 * Every call the server makes to the INKHAUS API, grouped by feature. Server
 * Components and route handlers import `adminApi` from here and nowhere else.
 *
 * FROZEN after Phase 0. Each group is its own file beside this one, so a
 * feature grows by editing that file; nothing here changes when it does.
 */
export const adminApi = {
  auth: authApi,
  orders: ordersApi,
  order: orderApi,
  quotes: quotesApi,
  customers: customersApi,
  catalog: catalogApi,
  reviews: reviewsApi,
  staff: staffApi,
  stats: statsApi,
  lookups: lookupsApi,
};

export { ApiError, type QueryValue } from "./core";

/**
 * Re-exported, not declared. The response types are `z.infer`s of the schemas
 * that parse those responses at runtime, so a shape and its checker cannot
 * drift - `import { type Order } from "@/lib/api"` resolves as it always has.
 * The feature files' own types (params, say) ride along the same way; a name
 * two of them share is a typecheck error here.
 */
export type * from "@/lib/schemas/api";
export type * from "./orders";
export type * from "./order";
export type * from "./quotes";
export type * from "./customers";
export type * from "./catalog";
export type * from "./reviews";
export type * from "./staff";
export type * from "./stats";
export type * from "./lookups";
