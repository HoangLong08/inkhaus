import { CUSTOMER_SORTS } from "@inkhaus/shared/admin";
import { z } from "zod";

import { pageParam, searchParam } from "./common";

/** `?hasOrders=` - the API's filter values: placed at least one order, or never */
export const CUSTOMERS_ORDER_FILTERS = ["yes", "no"] as const;

const customersQueryShape = z.object({
  q: searchParam,
  hasOrders: z.enum(CUSTOMERS_ORDER_FILTERS).optional().catch(undefined),
  // Left out of the URL when it is the default, so a plain /customers link and
  // every filter or pager link built from these params stay free of it. A sort
  // the API does not offer - a header clicked the other way - lands here too.
  sort: z.enum(CUSTOMER_SORTS).optional().catch(undefined),
  page: pageParam,
});

/**
 * Every field has its own `.catch()`; the outer one only covers input that is
 * not an object at all, so `.parse()` cannot throw.
 */
export const customersQuerySchema = customersQueryShape.catch(() => customersQueryShape.parse({}));

export type CustomersQuery = z.infer<typeof customersQuerySchema>;

/**
 * A customer id from a URL segment. The API issues cuids; this accepts anything
 * id-shaped, so a hand-typed path gets a 404 page rather than reaching the API
 * with slashes or spaces in it.
 */
export const customerIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
