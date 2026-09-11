import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyColorCreate } from "@/lib/mutations";
import { colorInputSchema } from "@/lib/schemas/forms";

/** the colours page's refetch after a write, and on window focus */
export const GET = route(async () => {
  await requireCapability("catalog.view");
  return NextResponse.json(await adminApi.catalog.colors());
});

export const POST = route(async (request: Request) => {
  await requireCapability("catalog.edit");
  const input = colorInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyColorCreate(input), { status: 201 });
});
