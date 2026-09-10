import { z } from "zod";

import { paginatedSchema, quoteStatusSchema } from "./core";

/**
 * The LEGACY bulk quote shape: `GET /bulk-quotes` and `PATCH /bulk-quotes/:id`.
 * The admin quote endpoints add assignee, follow-up and events on top.
 */
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

export const bulkQuoteListSchema = paginatedSchema(bulkQuoteSchema);

export type BulkQuote = z.infer<typeof bulkQuoteSchema>;
