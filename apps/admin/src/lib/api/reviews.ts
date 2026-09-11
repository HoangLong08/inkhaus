import {
  reviewBulkResultSchema,
  reviewDeleteResultSchema,
  reviewListItemSchema,
  reviewListSchema,
} from "@/lib/schemas/api";
import type { ReviewBulkInput, ReviewModerateInput } from "@/lib/schemas/forms";
import type { ReviewsQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

const one = (id: string) => `/admin/reviews/${encodeURIComponent(id)}`;

/** `/admin/reviews` - the moderation list and its three writes */
export const reviewsApi = {
  /** newest first; the page's parsed params, or any subset of them */
  list: (params: Partial<ReviewsQuery> = {}) =>
    request(`/admin/reviews${query(params)}`, { schema: reviewListSchema }),

  moderate: (id: string, input: ReviewModerateInput) =>
    request(one(id), { method: "PATCH", body: input, schema: reviewListItemSchema }),

  bulk: (input: ReviewBulkInput) =>
    request("/admin/reviews/bulk", { method: "POST", body: input, schema: reviewBulkResultSchema }),

  /** owner only - the API answers 403 to anyone else */
  remove: (id: string) => request(one(id), { method: "DELETE", schema: reviewDeleteResultSchema }),
};
