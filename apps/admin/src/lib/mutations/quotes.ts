import "server-only";

import { adminApi, type BulkQuote } from "@/lib/api";
import type { QuoteStatusInput } from "@/lib/schemas/forms";

/** No value-level rule: triaging a quote is not a money decision and never was. */
export async function applyQuoteStatus(id: string, input: QuoteStatusInput): Promise<BulkQuote> {
  return adminApi.quotes.setStatus(id, input.status);
}
