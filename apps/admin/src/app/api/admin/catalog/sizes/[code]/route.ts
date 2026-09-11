import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applySizeDelete, applySizeUpdate } from "@/lib/mutations";
import { sizeUpdateInputSchema } from "@/lib/schemas/forms";
import { sizeCodeParamSchema } from "@/lib/schemas/params";

type Ctx = { params: Promise<{ code: string }> };

/** `catalog.edit` for label and order; an upcharge in the body is checked inside applySizeUpdate */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const [user, params] = await Promise.all([requireCapability("catalog.edit"), ctx.params]);
  const code = sizeCodeParamSchema.parse(params.code);
  const input = sizeUpdateInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applySizeUpdate(user, code, input));
});

/**
 * The code is checked before anything is sent: `%2E%2E` arrives here as `..`,
 * which `encodeURIComponent` leaves alone, and a DELETE to `/sizes/..` is a
 * DELETE to another path upstream.
 */
export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const [, params] = await Promise.all([requireCapability("catalog.price"), ctx.params]);
  const code = sizeCodeParamSchema.parse(params.code);
  return NextResponse.json(await applySizeDelete(code));
});
