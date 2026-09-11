import {
  reviewBulkResultSchema,
  reviewDeleteResultSchema,
  reviewListItemSchema,
} from "@/lib/schemas/api";
import type { ReviewBulkInput, ReviewModerateInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

const one = (id: string) => `/reviews/${encodeURIComponent(id)}`;

/**
 * Browser calls for review moderation, through /api/admin/reviews. Writes only:
 * the list itself is server rendered, and a write ends in a router refresh.
 */
export const reviewsClient = {
  moderate: (id: string, input: ReviewModerateInput) =>
    call(one(id), reviewListItemSchema, json("PATCH", input)),

  bulk: (input: ReviewBulkInput) => call("/reviews/bulk", reviewBulkResultSchema, json("POST", input)),

  remove: (id: string) => call(one(id), reviewDeleteResultSchema, json("DELETE")),
};
