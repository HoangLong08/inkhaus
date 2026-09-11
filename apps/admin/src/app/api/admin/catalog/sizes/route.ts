import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applySizeCreate } from "@/lib/mutations";
import { sizeInputSchema } from "@/lib/schemas/forms";

/** the sizes page's refetch after a write, and on window focus */
export const GET = route(async () => {
  await requireCapability("catalog.view");
  return NextResponse.json(await adminApi.catalog.sizes());
});

/** a new code carries an upcharge: owners only, and refused while price edits are off */
export const POST = route(async (request: Request) => {
  await requireCapability("catalog.price");
  const input = sizeInputSchema.parse(await request.json());
  return NextResponse.json(await applySizeCreate(input), { status: 201 });
});
