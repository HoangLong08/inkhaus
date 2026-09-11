import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyQuoteNote } from "@/lib/mutations";
import { quoteNoteInputSchema } from "@/lib/schemas/forms";
import { quoteIdSchema } from "@/lib/schemas/params";

/** a staff note on the quote's history */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const [, { id }] = await Promise.all([requireCapability("quotes.manage"), ctx.params]);
  const input = quoteNoteInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyQuoteNote(quoteIdSchema.parse(id), input));
});
