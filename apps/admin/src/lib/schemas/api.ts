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
 * No `server-only`: client-api.ts parses the same shapes coming back from the
 * BFF, which is what guarantees a hydrated query and a client-fetched one hold
 * structurally identical objects.
 *
 * Enums are built from the shared constants rather than retyped. There used to
 * be three copies of the order status list in this app and they drifted.
 */

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const quoteStatusSchema = z.enum(QUOTE_STATUSES);
export const adminRoleSchema = z.enum(ADMIN_ROLES);

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable(),
  role: adminRoleSchema,
  lastLoginAt: z.string().nullable(),
});

export const orderSchema = z.object({
  number: z.string(),
  status: orderStatusSchema,
  currency: z.string(),
  customer: z.object({
    // Not z.email(). This one comes from a customer checkout, and an order that
    // renders is worth more to the operator than an order refused for an address
    // the API already accepted.
    email: z.string(),
    name: z.string().nullable(),
  }),
  items: z.array(
    z.object({
      productSlug: z.string(),
      productName: z.string(),
      color: z.object({ slug: z.string(), name: z.string(), hex: z.string() }),
      method: z.string(),
      designId: z.string().nullable(),
      unitPrice: z.number(),
      quantity: z.number(),
      lineTotal: z.number(),
      sizes: z.array(
        z.object({ size: z.string(), qty: z.number(), upcharge: z.number() }),
      ),
    }),
  ),
  subtotal: z.number(),
  discount: z.number(),
  shipping: z.number(),
  tax: z.number(),
  total: z.number(),
  shippingAddress: z.object({
    name: z.string().nullable(),
    line1: z.string().nullable(),
    line2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    postal: z.string().nullable(),
    country: z.string().nullable(),
  }),
  notes: z.string().nullable(),
  timeline: z.array(
    z.object({ status: orderStatusSchema, note: z.string().nullable(), at: z.string() }),
  ),
  placedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const bulkQuoteSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  company: z.string().nullable(),
  productSlug: z.string().nullable(),
  quantity: z.number(),
  method: z.string().nullable(),
  message: z.string().nullable(),
  estimated: z.number().nullable(),
  status: quoteStatusSchema,
  createdAt: z.string(),
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
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type Order = z.infer<typeof orderSchema>;
export type BulkQuote = z.infer<typeof bulkQuoteSchema>;

/** a z.infer of a factory cannot itself be generic, so meta carries the derivation */
export type Paginated<T> = { data: T[]; meta: z.infer<typeof paginationMetaSchema> };
