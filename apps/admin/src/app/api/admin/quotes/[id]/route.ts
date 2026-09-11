import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyQuoteUpdate } from "@/lib/mutations";
import { quoteUpdateInputSchema } from "@/lib/schemas/forms";
import { quoteIdSchema } from "@/lib/schemas/params";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, ctx: Context) => {
  const [, { id }] = await Promise.all([requireCapability("quotes.manage"), ctx.params]);
  return NextResponse.json(await adminApi.quotes.get(quoteIdSchema.parse(id)));
});

/** status, assignee and/or follow-up - one timeline event per field that changes */
export const PATCH = route(async (request: Request, ctx: Context) => {
  const [, { id }] = await Promise.all([requireCapability("quotes.manage"), ctx.params]);
  // a body that is not JSON at all is the caller's mistake: let zod say 400
  const input = quoteUpdateInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyQuoteUpdate(quoteIdSchema.parse(id), input));
});
