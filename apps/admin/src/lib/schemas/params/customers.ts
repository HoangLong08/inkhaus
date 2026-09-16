import { CUSTOMER_ORDER_FILTERS, CUSTOMER_SORTS } from "@inkhaus/shared/admin";
import { z } from "zod";

import { DEFAULT_PAGE_SIZE, limitParam, pageParam, searchParam } from "./common";

const customersQueryShape = z.object({
  q: searchParam,
  // the API's own list: placed at least one order, or never
  hasOrders: z.enum(CUSTOMER_ORDER_FILTERS).optional().catch(undefined),
  // Left out of the URL when it is the default, so a plain /customers link and
  // every filter or pager link built from these params stay free of it. Every
  // sortable column has both directions in CUSTOMER_SORTS, so a header clicked
  // a second time is a real sort; only a hand-typed one lands here.
  sort: z.enum(CUSTOMER_SORTS).optional().catch(undefined),
  page: pageParam,
  limit: limitParam,
});

/**
 * Every field has its own `.catch()`; the outer one only covers input that is
 * not an object at all, so `.parse()` cannot throw.
 */
export const customersQuerySchema = customersQueryShape.catch(() => customersQueryShape.parse({}));

export type CustomersQuery = z.infer<typeof customersQuerySchema>;

/**
 * What every control on this page carries in its links. The default page size is
 * left unspelled, so a plain `/customers` link and every filter, sort and pager
 * link built from these params stay free of `?limit=20`.
 */
export function customersLinkParams(params: CustomersQuery) {
  return {
    ...params,
    limit: params.limit === DEFAULT_PAGE_SIZE ? undefined : params.limit,
  };
}

/**
 * A customer id from a URL segment. The API issues cuids; this accepts anything
 * id-shaped, so a hand-typed path gets a 404 page rather than reaching the API
 * with slashes or spaces in it.
 */
export const customerIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
