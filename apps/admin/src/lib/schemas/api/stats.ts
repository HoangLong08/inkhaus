import { z } from "zod";

import { orderStatusSchema, quoteStatusSchema } from "./core";

/**
 * `GET /admin/stats/overview`, the baseline: counts by status, one groupBy each.
 *
 * A plain `z.object` on purpose - it strips keys it does not know rather than
 * rejecting them, so the API can grow this payload (revenue, series, top
 * products) before the admin reads any of it.
 *
 * `partialRecord`, not `record`: a status with no orders may simply be absent
 * from a groupBy. Read a count as `byStatus[status] ?? 0`.
 */
export const statsOverviewSchema = z.object({
  orders: z.object({
    byStatus: z.partialRecord(orderStatusSchema, z.number().int()),
  }),
  quotes: z.object({
    byStatus: z.partialRecord(quoteStatusSchema, z.number().int()),
  }),
  reviews: z.object({
    pending: z.number().int(),
  }),
});

export type StatsOverview = z.infer<typeof statsOverviewSchema>;
