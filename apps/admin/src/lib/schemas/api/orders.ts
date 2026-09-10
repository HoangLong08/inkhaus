import { ORDER_EVENT_KINDS } from "@inkhaus/shared/orders";
import { z } from "zod";

import { orderStatusSchema } from "./core";

/**
 * The LEGACY order shape: `GET /orders/:number` and `PATCH /orders/:n/status`.
 * Still what the order detail page reads until its admin endpoint replaces it -
 * see `order-detail.ts`. Fields the API adds later are optional here so an
 * older API and a newer one both parse.
 *
 * FROZEN after Phase 0.
 */

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
      sizes: z.array(z.object({ size: z.string(), qty: z.number(), upcharge: z.number() })),
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
    z.object({
      // additive: the public timeline carries STATUS and TRACKING events only
      kind: z.enum(ORDER_EVENT_KINDS).optional(),
      status: orderStatusSchema,
      note: z.string().nullable(),
      at: z.string(),
    }),
  ),
  // additive, and absent on an API that predates it
  tracking: z
    .object({ carrier: z.string(), number: z.string(), url: z.string().nullable() })
    .nullable()
    .optional(),
  placedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type Order = z.infer<typeof orderSchema>;
export type OrderTimelineEntry = Order["timeline"][number];
