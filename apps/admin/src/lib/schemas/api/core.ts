import { REVIEW_STATUSES } from "@inkhaus/shared/admin";
import { ADMIN_ROLES, ORDER_STATUSES, QUOTE_STATUSES } from "@inkhaus/shared/orders";
import { z } from "zod";

/**
 * What the INKHAUS API actually returns, checked at runtime.
 *
 * The API is a separate deployment on its own release cadence, so the old
 * `res.json() as Promise<T>` was a claim nothing ever verified - a renamed field
 * showed up as `undefined` three components deep, at render time, in production.
 * Parsing here turns that into one legible error at the boundary.
 *
 * No `server-only`: client-api parses the same shapes coming back from the BFF,
 * which is what guarantees a hydrated query and a client-fetched one hold
 * structurally identical objects.
 *
 * Enums are built from the shared constants rather than retyped. There used to
 * be three copies of the order status list in this app and they drifted.
 *
 * FROZEN after Phase 0: this file is the vocabulary every feature schema is
 * written in. A feature adds its shapes to its own file beside this one.
 */

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const quoteStatusSchema = z.enum(QUOTE_STATUSES);
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);
export const adminRoleSchema = z.enum(ADMIN_ROLES);

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable(),
  role: adminRoleSchema,
  lastLoginAt: z.string().nullable(),
});

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  pages: z.number().int(),
});

/**
 * Generic over the SCHEMA, not over its output. `<T>(item: z.ZodType<T>)` looks
 * tidier but loses inference on a nested call like paginatedSchema(orderSchema),
 * because zod 4's ZodType carries three parameters and is stricter about
 * variance than v3 was.
 */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: paginationMetaSchema });

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: adminUserSchema,
});

export const okSchema = z.object({ ok: z.literal(true) });

/* ------------------------------------------------------------------- types */

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type Session = z.infer<typeof sessionSchema>;

/** a z.infer of a factory cannot itself be generic, so meta carries the derivation */
export type Paginated<T> = { data: T[]; meta: PaginationMeta };
