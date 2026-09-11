import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyColorUpdate } from "@/lib/mutations";
import { colorUpdateInputSchema } from "@/lib/schemas/forms";
import { colorSlugParamSchema } from "@/lib/schemas/params";

/** rename, recolour, reorder or archive - a colour is never deleted (D11) */
export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const [, params] = await Promise.all([requireCapability("catalog.edit"), ctx.params]);
    // a 400 for a segment no slug could be, before it becomes part of an upstream path
    const slug = colorSlugParamSchema.parse(params.slug);
    const input = colorUpdateInputSchema.parse(await request.json().catch(() => null));
    return NextResponse.json(await applyColorUpdate(slug, input));
  },
);
