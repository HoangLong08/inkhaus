/**
 * The catalog now lives in PostgreSQL and is served by the NestJS API
 * (`GET /api/v1/catalog/products`). The types and the demo data behind the seed
 * live in `packages/shared`, so this file just re-exports them — components that
 * import `@/lib/catalog` keep working, and anything switching to live data can
 * fetch the same `Product` shape from the API.
 */
export type { Colorway, GarmentType, Product } from "@inkhaus/shared";
export {
  COLORS,
  PRODUCTS,
  getProduct,
  SIZES,
  TIERS,
  unitPrice,
  FREE_SHIPPING_OVER,
  SHIPPING_FLAT,
} from "@inkhaus/shared";
