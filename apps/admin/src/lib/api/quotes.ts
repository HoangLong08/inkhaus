import {
  adminQuoteConversionSchema,
  adminQuoteDetailSchema,
  adminQuoteListSchema,
  quoteConversionPricesSchema,
} from "@/lib/schemas/api";
import type { QuoteConvertInput, QuoteNoteInput, QuoteUpdateInput } from "@/lib/schemas/forms";
import type { QuotesQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

const path = (id: string) => `/admin/bulk-quotes/${encodeURIComponent(id)}`;

/** Bulk quotes, through `/admin/bulk-quotes`. */
export const quotesApi = {
  list: (params: Partial<QuotesQuery> = {}) =>
    request(`/admin/bulk-quotes${query(params)}`, { schema: adminQuoteListSchema }),

  get: (id: string) => request(path(id), { schema: adminQuoteDetailSchema }),

  update: (id: string, input: QuoteUpdateInput) =>
    request(path(id), { method: "PATCH", body: input, schema: adminQuoteDetailSchema }),

  addNote: (id: string, input: QuoteNoteInput) =>
    request(`${path(id)}/notes`, { method: "POST", body: input, schema: adminQuoteDetailSchema }),

  convert: (id: string, input: QuoteConvertInput) =>
    request(`${path(id)}/convert`, {
      method: "POST",
      body: input,
      schema: adminQuoteConversionSchema,
    }),

  /** list and bulk price per active product, for the convert dialog's estimate */
  conversionPrices: () =>
    request("/admin/bulk-quotes/conversion-prices", { schema: quoteConversionPricesSchema }),
};
