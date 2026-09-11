import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyProductCreate } from "@/lib/mutations";
import { productInputSchema } from "@/lib/schemas/forms";

/** A new blank: owners only (`catalog.create`), and refused while price edits are off. */
export const POST = route(async (request: Request) => {
  await requireCapability("catalog.create");
  const input = productInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyProductCreate(input), { status: 201 });
});
