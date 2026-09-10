import { z } from "zod";

import { reviewStatusSchema } from "../api";
import { pageParam } from "./common";

/**
 * Baseline only - status and page - so `queryKeys.reviews.list` has a parsed
 * type to be keyed by. The reviews workstream owns this file and extends it.
 */
export const reviewsQuerySchema = z.object({
  page: pageParam,
  status: reviewStatusSchema.optional().catch(undefined),
});

export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;
