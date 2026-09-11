import { PRODUCT_ACTIVE_FILTERS, PRODUCT_SORTS } from "@inkhaus/shared/admin";
import { z } from "zod";

import { catalogCategorySchema } from "../api";
import { limitParam, pageParam, searchParam } from "./common";

/**
 * What can name a product, a colour and a size. One copy, here: the input
 * schemas in `forms/catalog.ts` are built from these, and the API's DTOs
 * validate the same patterns.
 */
export const PRODUCT_SLUG_PATTERN = /^[a-z0-9-]{2,60}$/;
export const COLOR_SLUG_PATTERN = /^[a-z0-9-]{2,40}$/;
export const SIZE_CODE_PATTERN = /^[A-Z0-9]{1,6}$/;

/**
 * A product slug, colour slug or size code as it arrives in a URL segment.
 * Anything else cannot name one, so a page answers 404 and a route handler 400
 * without asking the API. It is also what keeps a `..` segment off the
 * upstream path: `encodeURIComponent("..")` is still `..`, and the sizes DELETE
 * would have gone to whatever path that resolved to.
 */
export const productSlugParamSchema = z.string().regex(PRODUCT_SLUG_PATTERN);
export const colorSlugParamSchema = z.string().regex(COLOR_SLUG_PATTERN);
export const sizeCodeParamSchema = z.string().regex(SIZE_CODE_PATTERN);

/** a sort as the products page's links spell it; a category is `catalogCategorySchema` */
export const productSortParamSchema = z.enum(PRODUCT_SORTS);

/**
 * `/catalog` URL state. `active` and `sort` are optional rather than defaulted:
 * absent means the API's own default (every product, shelf order), so the
 * links the page builds from this object never spell `?active=all`.
 */
const productsQueryShape = z.object({
  q: searchParam,
  category: catalogCategorySchema.optional().catch(undefined),
  active: z.enum(PRODUCT_ACTIVE_FILTERS).optional().catch(undefined),
  sort: productSortParamSchema.optional().catch(undefined),
  page: pageParam,
  limit: limitParam,
});

/** every field has its own `.catch()`; the outer one covers input that is not an object */
export const productsQuerySchema = productsQueryShape.catch(() => productsQueryShape.parse({}));

export type ProductsQuery = z.infer<typeof productsQuerySchema>;
