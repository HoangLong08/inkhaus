import { z } from "zod";

import { reviewStatusSchema } from "../api";
import { pageParam, searchParam } from "./common";

/** the rating chips, best first; the URL carries the digit */
export const REVIEW_RATINGS = ["5", "4", "3", "2", "1"] as const;

const reviewsQueryShape = z.object({
  /** author, handle or review text */
  q: searchParam,
  status: reviewStatusSchema.optional().catch(undefined),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  page: pageParam,
});

/**
 * `/reviews`. No page size: the list is fixed at the API's 20, which keeps a
 * select-all inside REVIEW_BULK_MAX without the page having to cap it.
 *
 * Every field has its own `.catch()`; the outer one only covers input that is
 * not an object at all, so `.parse()` still cannot throw.
 */
export const reviewsQuerySchema = reviewsQueryShape.catch(() => reviewsQueryShape.parse({}));

export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;
