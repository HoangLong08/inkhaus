import { CATEGORIES, GARMENT_TYPES, PRINT_METHODS } from "@inkhaus/shared/taxonomy";
import { z } from "zod";

import { paginatedSchema } from "./core";

/**
 * `/admin/catalog/*` response shapes - products, colours, sizes, price tiers.
 * The options lookup (`catalogOptionsSchema`) lives in `lookups.ts`.
 *
 * Enums come from `@inkhaus/shared/taxonomy`, the same tables the API's DTOs
 * validate writes against, so a value this app cannot render is a parse error
 * at the boundary rather than a blank cell.
 */

export const catalogGarmentTypeSchema = z.enum(GARMENT_TYPES);
export const catalogCategorySchema = z.enum(CATEGORIES);
export const catalogPrintMethodSchema = z.enum(PRINT_METHODS);

/** `GET /admin/catalog/products` - one row */
export const catalogProductListItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: catalogGarmentTypeSchema,
  category: catalogCategorySchema,
  price: z.number(),
  bulkPrice: z.number(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  methods: z.array(catalogPrintMethodSchema),
  colorCount: z.number().int(),
  /** distinct orders with a line for this product */
  orderCount: z.number().int(),
  updatedAt: z.string(),
});

export const catalogProductListSchema = paginatedSchema(catalogProductListItemSchema);

/**
 * One entry of a record's audit trail. `before`/`after` hold only the fields
 * that changed, in the API's own vocabulary (`price`, `colorSlugs`, …).
 */
export const catalogAuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  summary: z.string().nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  at: z.string(),
  actor: z
    .object({ id: z.string(), name: z.string().nullable(), email: z.string() })
    .nullable(),
});

export const catalogProductColorSchema = z.object({
  slug: z.string(),
  name: z.string(),
  hex: z.string(),
  dark: z.boolean(),
  active: z.boolean(),
});

/** `GET /admin/catalog/products/:slug` - and what every product write answers with */
export const catalogProductSchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: catalogGarmentTypeSchema,
  category: catalogCategorySchema,
  blurb: z.string(),
  fabric: z.string(),
  tag: z.string().nullable(),
  /** the raw run; empty means the default apparel run */
  sizes: z.array(z.string()),
  price: z.number(),
  bulkPrice: z.number(),
  methods: z.array(catalogPrintMethodSchema),
  printArea: z.object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int(),
    h: z.number().int(),
  }),
  printInches: z.object({ w: z.number(), h: z.number() }),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** in the product's own order - the first is the storefront's default */
  colors: z.array(catalogProductColorSchema),
  images: z.array(
    z.object({
      src: z.string(),
      src2x: z.string().nullable(),
      alt: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      color: z.string().nullable(),
    }),
  ),
  orderCount: z.number().int(),
  history: z.array(catalogAuditEntrySchema),
});

/** `GET /admin/catalog/colors` - one row; every colour write answers with one */
export const catalogColorSchema = z.object({
  slug: z.string(),
  name: z.string(),
  hex: z.string(),
  dark: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  productCount: z.number().int(),
  orderItemCount: z.number().int(),
});

export const catalogColorListSchema = z.array(catalogColorSchema);

/** `GET /admin/catalog/sizes` - one row; every size write answers with one */
export const catalogSizeSchema = z.object({
  code: z.string(),
  label: z.string(),
  upcharge: z.number(),
  sortOrder: z.number().int(),
  /** products whose run includes it - a product with no run of its own stocks the default run */
  productCount: z.number().int(),
  /** in the default run or the one-size code, so never deletable */
  builtIn: z.boolean(),
});

export const catalogSizeListSchema = z.array(catalogSizeSchema);

/** `GET`/`PUT /admin/catalog/price-tiers` - the same shape both ways */
export const catalogTierSchema = z.object({
  minQty: z.number().int(),
  /** a fraction: 0.12 is 12% off */
  discount: z.number(),
});

export const catalogTiersSchema = z.object({ tiers: z.array(catalogTierSchema) });

/* ------------------------------------------------------------------- types */

export type CatalogProductListItem = z.infer<typeof catalogProductListItemSchema>;
export type CatalogProductList = z.infer<typeof catalogProductListSchema>;
export type CatalogAuditEntry = z.infer<typeof catalogAuditEntrySchema>;
export type CatalogProductColor = z.infer<typeof catalogProductColorSchema>;
export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogColor = z.infer<typeof catalogColorSchema>;
export type CatalogSize = z.infer<typeof catalogSizeSchema>;
export type CatalogTier = z.infer<typeof catalogTierSchema>;
export type CatalogTiers = z.infer<typeof catalogTiersSchema>;
