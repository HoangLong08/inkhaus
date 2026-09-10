/**
 * Every API response schema, one file per feature. Import from here
 * (`@/lib/schemas/api`), never from a feature file - that is what keeps a
 * schema from being written twice.
 *
 * FROZEN after Phase 0. `export *` means a new export in any file below is
 * reachable without touching this one, and a name two files share is a
 * typecheck error rather than a silent shadow.
 */
export * from "./core";
export * from "./lookups";
export * from "./orders";
export * from "./orders-list";
export * from "./order-detail";
export * from "./quotes";
export * from "./customers";
export * from "./catalog";
export * from "./reviews";
export * from "./staff";
export * from "./stats";
