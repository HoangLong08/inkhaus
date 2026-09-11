import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyReviewBulk } from "@/lib/mutations";
import { reviewBulkInputSchema } from "@/lib/schemas/forms";

/**
 * A static segment beside `[id]`, which Next matches first - `bulk` is never
 * read as a review id. The selection is bounded and de-duplicated by the schema
 * before it goes anywhere; the API applies the same rule and runs the lot in one
 * transaction.
 */
export const POST = route(async (request: Request) => {
  const user = await requireCapability("reviews.moderate");
  const input = reviewBulkInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyReviewBulk(user, input));
});
