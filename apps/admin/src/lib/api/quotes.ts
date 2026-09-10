import { bulkQuoteListSchema, bulkQuoteSchema, type QuoteStatus } from "@/lib/schemas/api";
import type { QuotesQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

/**
 * Bulk quotes. Still the LEGACY endpoints (`/bulk-quotes`) - the quotes
 * workstream moves these to `/admin/bulk-quotes`.
 */
export const quotesApi = {
  list: (params: Partial<QuotesQuery> = {}) =>
    request(`/bulk-quotes${query(params)}`, { schema: bulkQuoteListSchema }),

  setStatus: (id: string, status: QuoteStatus) =>
    request(`/bulk-quotes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
      schema: bulkQuoteSchema,
    }),
};
