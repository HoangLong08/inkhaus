import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyQuoteConversion } from "@/lib/mutations";
import { quoteConvertInputSchema } from "@/lib/schemas/forms";
import { quoteIdSchema } from "@/lib/schemas/params";

/**
 * Turns the quote into a DRAFT order. The body is slugs and quantities only -
 * the schema has nowhere to put a price, and the API prices the order from
 * its own database regardless.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const [, { id }] = await Promise.all([requireCapability("quotes.convert"), ctx.params]);
  const input = quoteConvertInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyQuoteConversion(quoteIdSchema.parse(id), input));
});
