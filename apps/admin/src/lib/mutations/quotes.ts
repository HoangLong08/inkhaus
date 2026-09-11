import "server-only";

import { canConvertQuote, canSetQuoteStatus } from "@inkhaus/shared/orders";

import { adminApi, type AdminQuoteConversion, type AdminQuoteDetail } from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import type { QuoteConvertInput, QuoteNoteInput, QuoteUpdateInput } from "@/lib/schemas/forms";

/**
 * The value-level quote rules, checked here before the round trip and again by
 * the API, which is the check that actually protects the data. The route
 * handlers have already checked the capability; what they cannot express is a
 * rule about THIS quote - a converted one stays WON, and a quote becomes an
 * order at most once and never from LOST. The UI already hides both, so
 * reaching either refusal means a stale tab or a hand-made request, and it
 * gets a clear answer instead of a confusing upstream one.
 *
 * The detail carries the converted order's number rather than its id; either
 * is non-null exactly when the quote is an order, which is all the shared
 * rules look at.
 */
const conversionState = (quote: AdminQuoteDetail) => ({
  status: quote.status,
  convertedOrderId: quote.convertedOrderNumber,
});

export async function applyQuoteUpdate(
  id: string,
  input: QuoteUpdateInput,
): Promise<AdminQuoteDetail> {
  if (input.status !== undefined) {
    const quote = await adminApi.quotes.get(id);
    if (!canSetQuoteStatus(conversionState(quote), input.status)) {
      throw new HttpError(400, `This quote became order ${quote.convertedOrderNumber}, so it stays WON.`);
    }
  }
  return adminApi.quotes.update(id, input);
}

/** No value-level rule: anyone who may triage a quote may write on it. */
export function applyQuoteNote(id: string, input: QuoteNoteInput): Promise<AdminQuoteDetail> {
  return adminApi.quotes.addNote(id, input);
}

export async function applyQuoteConversion(
  id: string,
  input: QuoteConvertInput,
): Promise<AdminQuoteConversion> {
  const quote = await adminApi.quotes.get(id);
  if (!canConvertQuote(conversionState(quote))) {
    throw new HttpError(
      409,
      quote.convertedOrderNumber
        ? `This quote is already order ${quote.convertedOrderNumber}.`
        : "A lost quote cannot become an order. Reopen it first.",
    );
  }
  return adminApi.quotes.convert(id, input);
}
