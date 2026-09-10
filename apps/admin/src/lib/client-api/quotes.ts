import { bulkQuoteSchema } from "@/lib/schemas/api";
import type { QuoteStatusInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

export const quotesClient = {
  setStatus: (id: string, input: QuoteStatusInput) =>
    call(`/quotes/${encodeURIComponent(id)}`, bulkQuoteSchema, json("PATCH", input)),
};
