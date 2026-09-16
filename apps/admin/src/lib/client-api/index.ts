import { adminUserSchema } from "@/lib/schemas/api";

import { catalogClient } from "./catalog";
import { call } from "./core";
import { customersClient } from "./customers";
import { localeClient } from "./locale";
import { orderClient } from "./order";
import { quotesClient } from "./quotes";
import { reviewsClient } from "./reviews";
import { staffClient } from "./staff";

/**
 * Everything the browser may fetch, grouped by feature. Only TanStack Query
 * `queryFn`s and `mutationFn`s call this, and every path underneath is a
 * same-origin route handler under /api/admin - see AGENTS.md, "The BFF rule".
 *
 * FROZEN after Phase 0; each group is its own file beside this one.
 */
export const clientApi = {
  me: () => call("/me", adminUserSchema),
  locale: localeClient,
  order: orderClient,
  quotes: quotesClient,
  customers: customersClient,
  catalog: catalogClient,
  reviews: reviewsClient,
  staff: staffClient,
};

export { ClientApiError } from "./core";
