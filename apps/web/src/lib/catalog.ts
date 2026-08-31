/**
 * The catalog now lives in PostgreSQL and is served by the NestJS API
 * (`GET /api/v1/catalog/products`). The types and the demo data behind the seed
 * live in `packages/shared`, so this file just re-exports them — components that
 * import `@/lib/catalog` keep working, and anything switching to live data can
 * fetch the same `Product` shape from the API.
 */
export type {
  Colorway,
  GarmentType,
  Product,
  ProductCategory,
  ProductImage,
  Quote,
  QuoteLine,
  Size,
  Tier,
} from "@inkhaus/shared";
export {
  CATEGORIES,
  CATEGORY_LABEL,
  COLORS,
  PRODUCTS,
  PRODUCT_IMAGES,
  getProduct,
  ONE_SIZE,
  SIZES,
  SIZE_LABEL,
  SIZE_UPCHARGE,
  sizesFor,
  TIERS,
  quote,
  round,
  tierFor,
  unitPrice,
  FREE_SHIPPING_OVER,
  SHIPPING_FLAT,
} from "@inkhaus/shared";
