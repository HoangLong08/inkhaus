import { ORDER_EVENT_KINDS } from "@inkhaus/shared/orders";
import { z } from "zod";

import { orderStatusSchema } from "./core";

/**
 * `GET /admin/orders/:number` - the admin order detail - and every write under
 * it, which answers with the same shape so a mutation can replace the cache
 * entry in one step: customer id, per-size pricing, design refs, tracking, and
 * a timeline with internal notes and who did what.
 *
 * Carriers and print methods are plain strings rather than enums on purpose.
 * They are stored as strings, and an order the API can show is worth more to
 * the operator than one refused because a new carrier reached the database
 * before it reached this app.
 */

export const adminOrderDetailTrackingSchema = z.object({
  carrier: z.string(),
  number: z.string(),
  // rendered as an href - https or nothing, whatever the API sends
  url: z.url({ protocol: /^https$/ }).nullable(),
});

export const adminOrderDetailActorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
});

export const adminOrderDetailEventSchema = z.object({
  id: z.string(),
  kind: z.enum(ORDER_EVENT_KINDS),
  /** the order's status when it happened - for STATUS, the one it moved into */
  status: orderStatusSchema,
  note: z.string().nullable(),
  at: z.string(),
  /** null for the storefront and for history older than the column */
  actor: adminOrderDetailActorSchema.nullable(),
  /** a TRACKING event's carrier, number and link */
  tracking: adminOrderDetailTrackingSchema.nullable(),
});

export const adminOrderDetailItemSchema = z.object({
  productSlug: z.string(),
  productName: z.string(),
  color: z.object({ slug: z.string(), name: z.string(), hex: z.string() }),
  method: z.string(),
  /** tier price for one unit, before size upcharges */
  unitPrice: z.number(),
  quantity: z.number().int(),
  lineTotal: z.number(),
  sizes: z.array(
    z.object({
      size: z.string(),
      qty: z.number().int(),
      upcharge: z.number(),
      /** the tier price plus this size's upcharge */
      unitPrice: z.number(),
      lineTotal: z.number(),
    }),
  ),
  design: z
    .object({
      publicId: z.string(),
      name: z.string(),
      hasFront: z.boolean(),
      hasBack: z.boolean(),
    })
    .nullable(),
});

export const adminOrderDetailSchema = z.object({
  number: z.string(),
  status: orderStatusSchema,
  currency: z.string(),
  customer: z.object({
    id: z.string(),
    // not z.email() - see orderSchema
    email: z.string(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    company: z.string().nullable(),
  }),
  items: z.array(adminOrderDetailItemSchema),
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
  /** what the customer wrote at checkout */
  notes: z.string().nullable(),
  tracking: adminOrderDetailTrackingSchema.nullable(),
  /** oldest first, every kind */
  timeline: z.array(adminOrderDetailEventSchema),
  /** the bulk quote this order was converted from */
  quote: z.object({ id: z.string() }).nullable(),
  placedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * `GET /admin/designs/:publicId/preview`. Read only by the preview route
 * handler, which decodes one side and answers with the bytes - the data URLs
 * never reach a page.
 */
export const adminDesignPreviewSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  productSlug: z.string(),
  colorHex: z.string().nullable(),
  previewFront: z.string().nullable(),
  previewBack: z.string().nullable(),
});

export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;
export type AdminOrderDetailItem = z.infer<typeof adminOrderDetailItemSchema>;
export type AdminOrderDetailEvent = z.infer<typeof adminOrderDetailEventSchema>;
export type AdminOrderDetailActor = z.infer<typeof adminOrderDetailActorSchema>;
export type AdminOrderDetailTracking = z.infer<typeof adminOrderDetailTrackingSchema>;
export type AdminDesignPreview = z.infer<typeof adminDesignPreviewSchema>;
