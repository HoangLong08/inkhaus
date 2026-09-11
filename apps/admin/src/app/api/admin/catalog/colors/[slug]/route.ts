import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyColorUpdate } from "@/lib/mutations";
import { colorUpdateInputSchema } from "@/lib/schemas/forms";

/** rename, recolour, reorder or archive - a colour is never deleted (D11) */
export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const [, { slug }] = await Promise.all([requireCapability("catalog.edit"), ctx.params]);
    const input = colorUpdateInputSchema.parse(await request.json());
    return NextResponse.json(await applyColorUpdate(slug, input));
  },
);
