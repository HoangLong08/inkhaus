import { PRODUCT_ACTIVE_FILTERS, PRODUCT_SORTS } from "@inkhaus/shared/admin";
import { CATEGORIES } from "@inkhaus/shared/taxonomy";
import { z } from "zod";

import { limitParam, pageParam, searchParam } from "./common";

/**
 * `/catalog` URL state. `active` and `sort` are optional rather than defaulted:
 * absent means the API's own default (every product, shelf order), so the
 * links the page builds from this object never spell `?active=all`.
 */
const productsQueryShape = z.object({
  q: searchParam,
  category: z.enum(CATEGORIES).optional().catch(undefined),
  active: z.enum(PRODUCT_ACTIVE_FILTERS).optional().catch(undefined),
  sort: z.enum(PRODUCT_SORTS).optional().catch(undefined),
  page: pageParam,
  limit: limitParam,
});

/** every field has its own `.catch()`; the outer one covers input that is not an object */
export const productsQuerySchema = productsQueryShape.catch(() => productsQueryShape.parse({}));

export type ProductsQuery = z.infer<typeof productsQuerySchema>;
