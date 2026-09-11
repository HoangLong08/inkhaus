import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applySizeDelete, applySizeUpdate } from "@/lib/mutations";
import { sizeUpdateInputSchema } from "@/lib/schemas/forms";

type Ctx = { params: Promise<{ code: string }> };

/** `catalog.edit` for label and order; an upcharge in the body is checked inside applySizeUpdate */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const [user, { code }] = await Promise.all([requireCapability("catalog.edit"), ctx.params]);
  const input = sizeUpdateInputSchema.parse(await request.json());
  return NextResponse.json(await applySizeUpdate(user, code, input));
});

export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const [, { code }] = await Promise.all([requireCapability("catalog.price"), ctx.params]);
  return NextResponse.json(await applySizeDelete(code));
});
