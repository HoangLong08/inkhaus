import { z } from "zod";

import { orderStatusSchema, paginatedSchema, quoteStatusSchema } from "./core";

/**
 * `GET|PATCH /admin/customers[/:id]` response shapes, plus the owner-only
 * `GET /admin/designs?customerId=` the profile's Designs tab reads.
 */

export const customerListItemSchema = z.object({
  id: z.string(),
  // Not z.email(): the address arrived through a storefront checkout or lead
  // form the API already accepted, and a customer that renders is worth more
  // than one refused over its spelling.
  email: z.string(),
  name: z.string().nullable(),
  company: z.string().nullable(),
  phone: z.string().nullable(),
  googleLinked: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  /** placed orders - drafts are not the customer's doing */
  orderCount: z.number().int(),
  lifetimeValue: z.number(),
  lastOrderAt: z.string().nullable(),
});

export const customerListSchema = paginatedSchema(customerListItemSchema);

/**
 * A row of the profile's Orders tab. The API sends a whole orders-list item;
 * this keeps what the tab draws, so the tab does not break when that list grows
 * a column.
 */
export const customerOrderRowSchema = z.object({
  number: z.string(),
  status: orderStatusSchema,
  units: z.number().int(),
  total: z.number(),
  placedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const customerQuoteRowSchema = z.object({
  id: z.string(),
  status: quoteStatusSchema,
  quantity: z.number().int(),
  product: z.object({ slug: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});

export const customerDetailSchema = customerListItemSchema.extend({
  /** staff-only; never shown anywhere but the back office */
  adminNote: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  stats: z.object({
    refunded: z.number(),
    averageOrder: z.number(),
    firstOrderAt: z.string().nullable(),
    quoteCount: z.number().int(),
    openQuoteCount: z.number().int(),
    designCount: z.number().int(),
  }),
  recentOrders: z.array(customerOrderRowSchema),
  quotes: z.array(customerQuoteRowSchema),
});

/**
 * One saved design, from the owner-only `GET /admin/designs?customerId=`. The
 * API sends labels and whether each side can be drawn, never the scene or a
 * preview: the tab draws its thumbnails through the design-preview BFF route.
 */
export const customerDesignSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  product: z.object({ slug: z.string(), name: z.string() }),
  createdAt: z.string(),
  hasFront: z.boolean(),
  hasBack: z.boolean(),
});

/** newest first, at most CUSTOMER_DESIGNS_MAX */
export const customerDesignListSchema = z.array(customerDesignSchema);

export type CustomerListItem = z.infer<typeof customerListItemSchema>;
export type CustomerList = z.infer<typeof customerListSchema>;
export type CustomerOrderRow = z.infer<typeof customerOrderRowSchema>;
export type CustomerQuoteRow = z.infer<typeof customerQuoteRowSchema>;
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
export type CustomerDesign = z.infer<typeof customerDesignSchema>;
