import {
  catalogColorListSchema,
  catalogColorSchema,
  catalogProductListSchema,
  catalogProductSchema,
  catalogSizeListSchema,
  catalogSizeSchema,
  catalogTiersSchema,
  okSchema,
} from "@/lib/schemas/api";
import type {
  ColorInput,
  ColorUpdateInput,
  ProductInput,
  ProductUpdateInput,
  SizeInput,
  SizeUpdateInput,
  TiersInput,
} from "@/lib/schemas/forms";
import type { ProductsQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

/**
 * The products page's parsed params, or any subset. `limit` is open so a server
 * component can ask for exactly what it shows - the tier preview's product
 * picker wants every active blank at once.
 */
export type CatalogProductsParams = Omit<Partial<ProductsQuery>, "limit"> & { limit?: number };

const at = encodeURIComponent;

/**
 * `/admin/catalog/*` calls. The options lookup is `adminApi.lookups.catalogOptions`.
 * Writes return the saved record, so a mutation can put it straight into the cache.
 */
export const catalogApi = {
  products: (params: CatalogProductsParams = {}) =>
    request(`/admin/catalog/products${query(params)}`, { schema: catalogProductListSchema }),

  product: (slug: string) =>
    request(`/admin/catalog/products/${at(slug)}`, { schema: catalogProductSchema }),

  createProduct: (input: ProductInput) =>
    request("/admin/catalog/products", {
      method: "POST",
      body: input,
      schema: catalogProductSchema,
    }),

  updateProduct: (slug: string, input: ProductUpdateInput) =>
    request(`/admin/catalog/products/${at(slug)}`, {
      method: "PATCH",
      body: input,
      schema: catalogProductSchema,
    }),

  colors: () => request("/admin/catalog/colors", { schema: catalogColorListSchema }),

  createColor: (input: ColorInput) =>
    request("/admin/catalog/colors", { method: "POST", body: input, schema: catalogColorSchema }),

  updateColor: (slug: string, input: ColorUpdateInput) =>
    request(`/admin/catalog/colors/${at(slug)}`, {
      method: "PATCH",
      body: input,
      schema: catalogColorSchema,
    }),

  sizes: () => request("/admin/catalog/sizes", { schema: catalogSizeListSchema }),

  createSize: (input: SizeInput) =>
    request("/admin/catalog/sizes", { method: "POST", body: input, schema: catalogSizeSchema }),

  updateSize: (code: string, input: SizeUpdateInput) =>
    request(`/admin/catalog/sizes/${at(code)}`, {
      method: "PATCH",
      body: input,
      schema: catalogSizeSchema,
    }),

  deleteSize: (code: string) =>
    request(`/admin/catalog/sizes/${at(code)}`, { method: "DELETE", schema: okSchema }),

  tiers: () => request("/admin/catalog/price-tiers", { schema: catalogTiersSchema }),

  replaceTiers: (input: TiersInput) =>
    request("/admin/catalog/price-tiers", {
      method: "PUT",
      body: input,
      schema: catalogTiersSchema,
    }),
};
