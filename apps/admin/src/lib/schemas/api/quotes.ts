import { QUOTE_EVENT_KINDS } from "@inkhaus/shared/orders";
import { z } from "zod";

import { orderStatusSchema, paginatedSchema, quoteStatusSchema } from "./core";

/**
 * `/admin/bulk-quotes` - the back-office quote list, one quote's detail, and
 * what a conversion answers with. Every write answers with the detail, so a
 * mutation can hand the server's own timeline straight to the cache.
 */

const quotePersonSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
});

export const adminQuoteListItemSchema = z.object({
  id: z.string(),
  // Not z.email(): the address came from a customer's form, and a quote that
  // renders is worth more than one refused for an address the API accepted.
  email: z.string(),
  name: z.string().nullable(),
  company: z.string().nullable(),
  product: z.object({ slug: z.string(), name: z.string() }).nullable(),
  quantity: z.number().int(),
  method: z.string().nullable(),
  estimated: z.number().nullable(),
  status: quoteStatusSchema,
  assignee: quotePersonSchema.nullable(),
  /** midnight UTC of the day to chase it */
  followUpAt: z.string().nullable(),
  convertedOrderNumber: z.string().nullable(),
  noteCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminQuoteListSchema = paginatedSchema(adminQuoteListItemSchema);

export const adminQuoteEventSchema = z.object({
  id: z.string(),
  kind: z.enum(QUOTE_EVENT_KINDS),
  status: quoteStatusSchema.nullable(),
  note: z.string().nullable(),
  at: z.string(),
  actor: quotePersonSchema.nullable(),
});

export const adminQuoteDetailSchema = adminQuoteListItemSchema.extend({
  message: z.string().nullable(),
  customer: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      company: z.string().nullable(),
      phone: z.string().nullable(),
      orderCount: z.number().int(),
    })
    .nullable(),
  events: z.array(adminQuoteEventSchema),
  liveEstimate: z.number().nullable(),
  convertedOrder: z.object({ number: z.string(), status: orderStatusSchema }).nullable(),
});

/** `POST /admin/bulk-quotes/:id/convert` */
export const adminQuoteConversionSchema = z.object({
  order: z.object({ number: z.string() }),
  quote: adminQuoteDetailSchema,
});

export type AdminQuoteListItem = z.infer<typeof adminQuoteListItemSchema>;
export type AdminQuoteDetail = z.infer<typeof adminQuoteDetailSchema>;
export type AdminQuoteEvent = z.infer<typeof adminQuoteEventSchema>;
export type AdminQuoteConversion = z.infer<typeof adminQuoteConversionSchema>;
