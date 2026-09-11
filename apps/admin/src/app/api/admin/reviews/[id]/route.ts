import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyReviewDelete, applyReviewModeration } from "@/lib/mutations";
import { reviewIdSchema, reviewModerateInputSchema } from "@/lib/schemas/forms";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The BFF third of the capability rule: the table hides what a role may not do,
 * these refuse it with a 403, and the API refuses it again. Delete is its own
 * capability (`reviews.delete`, owners only), not a kind of moderation, so it
 * is checked first here - before the id is even looked at.
 *
 * A body that is not JSON parses as null and fails the schema: a 400 that says
 * so, rather than a SyntaxError surfacing as a 500.
 */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const [user, { id }] = await Promise.all([requireCapability("reviews.moderate"), ctx.params]);
  const input = reviewModerateInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyReviewModeration(user, reviewIdSchema.parse(id), input));
});

export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const [user, { id }] = await Promise.all([requireCapability("reviews.delete"), ctx.params]);
  return NextResponse.json(await applyReviewDelete(user, reviewIdSchema.parse(id)));
});
