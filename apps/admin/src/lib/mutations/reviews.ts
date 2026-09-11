import "server-only";

import { can, type AdminAction } from "@inkhaus/shared/admin";

import {
  adminApi,
  type AdminUser,
  type ReviewBulkResult,
  type ReviewDeleteResult,
  type ReviewListItem,
} from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import type { ReviewBulkInput, ReviewModerateInput } from "@/lib/schemas/forms";

/**
 * Review moderation writes with their authorization attached.
 *
 * The route handlers run `requireCapability` for the same action before they
 * get here. Checking again is not redundant: it is what stops a second caller -
 * a server action, a script - from reaching the API without asking, and it is
 * the check that stays true if a handler is ever rewritten. The API refuses a
 * third time with `@Can`, and that is the one that actually protects the data.
 *
 * The value-level rules - a known status, 1..REVIEW_BULK_MAX distinct ids - are
 * the zod schemas these inputs were parsed with, which the API mirrors.
 */
function assertMay(user: AdminUser, action: AdminAction, message: string) {
  if (!can(user.role, action)) throw new HttpError(403, message);
}

export async function applyReviewModeration(
  user: AdminUser,
  id: string,
  input: ReviewModerateInput,
): Promise<ReviewListItem> {
  assertMay(user, "reviews.moderate", "You cannot moderate reviews.");
  return adminApi.reviews.moderate(id, input);
}

export async function applyReviewBulk(
  user: AdminUser,
  input: ReviewBulkInput,
): Promise<ReviewBulkResult> {
  assertMay(user, "reviews.moderate", "You cannot moderate reviews.");
  return adminApi.reviews.bulk(input);
}

/** deleting is for good, so it is an owner's call */
export async function applyReviewDelete(user: AdminUser, id: string): Promise<ReviewDeleteResult> {
  assertMay(user, "reviews.delete", "Only an owner can delete a review.");
  return adminApi.reviews.remove(id);
}
