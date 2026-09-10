import { z } from "zod";

import { orderStatusSchema, paginatedSchema } from "./core";

/**
 * `GET /admin/orders` - one row of the orders table.
 *
 * Deliberately not the full order: a list needs the unit count, not the line
 * items that add up to it. The legacy `/orders` list returned every item of
 * every order so the table could sum them.
 */
export const adminOrderListItemSchema = z.object({
  number: z.string(),
  status: orderStatusSchema,
  customer: z.object({
    id: z.string(),
    // not z.email() - see orderSchema
    email: z.string(),
    name: z.string().nullable(),
  }),
  units: z.number().int(),
  total: z.number(),
  currency: z.string(),
  placedAt: z.string().nullable(),
  createdAt: z.string(),
  carrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
});

export const adminOrderListSchema = paginatedSchema(adminOrderListItemSchema);

export type AdminOrderListItem = z.infer<typeof adminOrderListItemSchema>;
export type AdminOrderList = z.infer<typeof adminOrderListSchema>;
