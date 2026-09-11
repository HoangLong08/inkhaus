import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyProductUpdate } from "@/lib/mutations";
import { productUpdateInputSchema } from "@/lib/schemas/forms";
import { productSlugParamSchema } from "@/lib/schemas/params";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const [, params] = await Promise.all([requireCapability("catalog.view"), ctx.params]);
  // a 400 for a segment no slug could be, before it becomes part of an upstream path
  const slug = productSlugParamSchema.parse(params.slug);
  return NextResponse.json(await adminApi.catalog.product(slug));
});

/**
 * `catalog.edit` for the route; the price fields' own rule - owner, and price
 * edits on - is applied inside applyProductUpdate, because it depends on the
 * body. The API checks all of it again.
 */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const [user, params] = await Promise.all([requireCapability("catalog.edit"), ctx.params]);
  const slug = productSlugParamSchema.parse(params.slug);
  const input = productUpdateInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyProductUpdate(user, slug, input));
});
