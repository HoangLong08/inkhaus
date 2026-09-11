import { REVIEW_BULK_MAX } from "@inkhaus/shared/admin";
import { z } from "zod";

import { reviewStatusSchema } from "../api";

/**
 * Review moderation input, shared by the table that sends it and the route
 * handlers that receive it.
 *
 * The id format is what Prisma's `cuid()` produces, the same pattern the API's
 * `admin-reviews.rules.ts` checks. It is checked here as well because the BFF
 * puts the id into an upstream path: `..` survives `encodeURIComponent`, and a
 * request for `/admin/reviews/..` is a request for something else entirely.
 */
export const reviewIdSchema = z.string().regex(/^c[a-z0-9]{24}$/, "That is not a review id.");

export const reviewModerateInputSchema = z.object({
  status: reviewStatusSchema,
});

/** 1..REVIEW_BULK_MAX distinct ids - the API refuses anything else with the same rule */
export const reviewBulkInputSchema = z.object({
  ids: z
    .array(reviewIdSchema)
    .min(1, "Select at least one review.")
    .max(REVIEW_BULK_MAX, `Moderate at most ${REVIEW_BULK_MAX} reviews at a time.`)
    .refine((ids) => new Set(ids).size === ids.length, "Each review may appear only once."),
  status: reviewStatusSchema,
});

export type ReviewModerateInput = z.infer<typeof reviewModerateInputSchema>;
export type ReviewBulkInput = z.infer<typeof reviewBulkInputSchema>;
