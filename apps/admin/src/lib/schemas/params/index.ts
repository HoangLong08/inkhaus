/**
 * URL state, parsed once and then trusted - `searchParams` in pages and the
 * query strings the BFF route handlers receive. Import from here
 * (`@/lib/schemas/params`).
 *
 * FROZEN after Phase 0; each feature owns its own file below.
 */
export * from "./common";
export * from "./orders";
export * from "./quotes";
export * from "./overview";
export * from "./customers";
export * from "./catalog";
export * from "./reviews";
