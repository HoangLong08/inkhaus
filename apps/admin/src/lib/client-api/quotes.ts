import { adminQuoteConversionSchema, adminQuoteDetailSchema } from "@/lib/schemas/api";
import type { QuoteConvertInput, QuoteNoteInput, QuoteUpdateInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

const path = (id: string) => `/quotes/${encodeURIComponent(id)}`;

/**
 * The quote page's client leaves, through /api/admin/quotes/:id. The list is
 * server rendered and never fetched from the browser.
 */
export const quotesClient = {
  get: (id: string) => call(path(id), adminQuoteDetailSchema),

  update: (id: string, input: QuoteUpdateInput) =>
    call(path(id), adminQuoteDetailSchema, json("PATCH", input)),

  addNote: (id: string, input: QuoteNoteInput) =>
    call(`${path(id)}/notes`, adminQuoteDetailSchema, json("POST", input)),

  convert: (id: string, input: QuoteConvertInput) =>
    call(`${path(id)}/convert`, adminQuoteConversionSchema, json("POST", input)),
};
