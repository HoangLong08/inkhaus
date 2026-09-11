import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyProductUpdate } from "@/lib/mutations";
import { productUpdateInputSchema } from "@/lib/schemas/forms";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const [, { slug }] = await Promise.all([requireCapability("catalog.view"), ctx.params]);
  return NextResponse.json(await adminApi.catalog.product(slug));
});

/**
 * `catalog.edit` for the route; the price fields' own rule - owner, and price
 * edits on - is applied inside applyProductUpdate, because it depends on the
 * body. The API checks all of it again.
 */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const [user, { slug }] = await Promise.all([requireCapability("catalog.edit"), ctx.params]);
  const input = productUpdateInputSchema.parse(await request.json());
  return NextResponse.json(await applyProductUpdate(user, slug, input));
});
