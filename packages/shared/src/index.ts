export * from "./admin";
export * from "./catalog";
export * from "./clipart";
export * from "./orders";
export * from "./pricing";
export * from "./product-images";
// explicit, not `export *`: catalog.ts already re-exports the taxonomy's
// CATEGORIES and friends, and a second star export of the same names is an error
export {
  GARMENT_TYPES,
  GARMENT_TYPE_LABEL,
  PRINT_METHODS,
  PRINT_METHOD_LABEL,
  type PrintMethodCode,
} from "./taxonomy";
