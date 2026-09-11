import { z } from "zod";

import { paginatedSchema, reviewStatusSchema } from "./core";

/**
 * `/admin/reviews` response shapes. The status enum (`reviewStatusSchema`) is in
 * `core.ts`. Every export carries the `review` prefix - `index.ts` re-exports
 * every file here with `export *`, so a name two files share fails typecheck.
 */

/** one row of the moderation list, and what a single moderation answers with */
export const reviewListItemSchema = z.object({
  id: z.string(),
  author: z.string(),
  handle: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  /** null for a review of the shop as a whole */
  product: z.object({ slug: z.string(), name: z.string() }).nullable(),
  status: reviewStatusSchema,
  createdAt: z.string(),
  /** when it was last published or rejected; null while it is pending */
  moderatedAt: z.string().nullable(),
  /** null while pending, and for a decision whose moderator has since been removed */
  moderatedBy: z
    .object({ id: z.string(), name: z.string().nullable(), email: z.string() })
    .nullable(),
});

export const reviewListSchema = paginatedSchema(reviewListItemSchema);

/** reviews that actually moved - ones already in the target status are not counted */
export const reviewBulkResultSchema = z.object({ updated: z.number().int().min(0) });

export const reviewDeleteResultSchema = z.object({ deleted: z.literal(true), id: z.string() });

export type ReviewListItem = z.infer<typeof reviewListItemSchema>;
export type ReviewList = z.infer<typeof reviewListSchema>;
export type ReviewBulkResult = z.infer<typeof reviewBulkResultSchema>;
export type ReviewDeleteResult = z.infer<typeof reviewDeleteResultSchema>;
