import {
  catalogColorListSchema,
  catalogColorSchema,
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

import { call, json } from "./core";

const at = encodeURIComponent;

/** Browser calls for the catalog screens, through /api/admin/catalog. */
export const catalogClient = {
  product: (slug: string) => call(`/catalog/products/${at(slug)}`, catalogProductSchema),

  createProduct: (input: ProductInput) =>
    call("/catalog/products", catalogProductSchema, json("POST", input)),

  updateProduct: (slug: string, input: ProductUpdateInput) =>
    call(`/catalog/products/${at(slug)}`, catalogProductSchema, json("PATCH", input)),

  colors: () => call("/catalog/colors", catalogColorListSchema),

  createColor: (input: ColorInput) => call("/catalog/colors", catalogColorSchema, json("POST", input)),

  updateColor: (slug: string, input: ColorUpdateInput) =>
    call(`/catalog/colors/${at(slug)}`, catalogColorSchema, json("PATCH", input)),

  sizes: () => call("/catalog/sizes", catalogSizeListSchema),

  createSize: (input: SizeInput) => call("/catalog/sizes", catalogSizeSchema, json("POST", input)),

  updateSize: (code: string, input: SizeUpdateInput) =>
    call(`/catalog/sizes/${at(code)}`, catalogSizeSchema, json("PATCH", input)),

  deleteSize: (code: string) => call(`/catalog/sizes/${at(code)}`, okSchema, json("DELETE")),

  tiers: () => call("/catalog/price-tiers", catalogTiersSchema),

  replaceTiers: (input: TiersInput) =>
    call("/catalog/price-tiers", catalogTiersSchema, json("PUT", input)),
};
