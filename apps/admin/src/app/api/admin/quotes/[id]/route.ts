import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyQuoteStatus } from "@/lib/mutations";
import { quoteStatusInputSchema } from "@/lib/schemas/forms";

export const PATCH = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const [, { id }] = await Promise.all([requireCapability("quotes.manage"), ctx.params]);
  const input = quoteStatusInputSchema.parse(await request.json());
  return NextResponse.json(await applyQuoteStatus(id, input));
});
