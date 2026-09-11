import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyTiersReplace } from "@/lib/mutations";
import { tiersInputSchema } from "@/lib/schemas/forms";

export const GET = route(async () => {
  await requireCapability("catalog.view");
  return NextResponse.json(await adminApi.catalog.tiers());
});

/**
 * The whole ladder. The body is checked with `validateTiers` before it leaves
 * this server, so a hand-made ladder gets the tier editor's own sentence.
 */
export const PUT = route(async (request: Request) => {
  await requireCapability("catalog.price");
  const input = tiersInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyTiersReplace(input));
});
