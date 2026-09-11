import { STATS_RANGES } from "@inkhaus/shared/admin";
import { z } from "zod";

import { orderStatusSchema, quoteStatusSchema } from "./core";

/**
 * `GET /admin/stats/overview`.
 *
 * The baseline - counts by status, one groupBy each - is required. Everything
 * the range added after it is `.optional()` until every deployed API sends it
 * (AGENTS.md §3): each overview section renders nothing when its block is
 * missing, so an API one release behind costs the page its charts, not its
 * queues.
 *
 * `partialRecord`, not `record`: a status with no rows may simply be absent
 * from a groupBy. Read a count as `byStatus[status] ?? 0`.
 */
const orderCountsSchema = z.partialRecord(orderStatusSchema, z.number().int());
const quoteCountsSchema = z.partialRecord(quoteStatusSchema, z.number().int());

const statsRangeSchema = z.object({
  /** first and last day, both inclusive, UTC `YYYY-MM-DD` */
  from: z.string(),
  to: z.string(),
  days: z.number().int(),
  /** the preset the window came from; null for an explicit from/to */
  key: z.enum(STATS_RANGES).nullable(),
});

const statsSeriesPointSchema = z.object({
  /** a UTC calendar day, `YYYY-MM-DD` */
  date: z.string(),
  orders: z.number().int(),
  revenue: z.number(),
});

const statsTopProductSchema = z.object({
  slug: z.string(),
  name: z.string(),
  units: z.number().int(),
  /** line totals - before shipping, tax and discounts */
  revenue: z.number(),
});

const statsAttentionSchema = z.object({
  staleQuotes: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      company: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  overdueFollowUps: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      /** midnight UTC of the day it was due */
      followUpAt: z.string(),
      assignee: z
        .object({ id: z.string(), name: z.string().nullable(), email: z.string() })
        .nullable(),
    }),
  ),
  stuckOrders: z.array(
    z.object({
      number: z.string(),
      status: orderStatusSchema,
      /** the last time the order changed at all */
      since: z.string(),
    }),
  ),
});

export const statsOverviewSchema = z.object({
  range: statsRangeSchema.optional(),
  orders: z.object({
    byStatus: orderCountsSchema,
    /** placed in the range, any status but DRAFT */
    placed: z.number().int().optional(),
  }),
  /** orders placed in the range; `orders` counts the revenue statuses only */
  revenue: z
    .object({
      gross: z.number(),
      orders: z.number().int(),
      averageOrder: z.number(),
      refunded: z.number(),
    })
    .optional(),
  /** one point per day of the range, zero-filled */
  series: z.array(statsSeriesPointSchema).optional(),
  topProducts: z.array(statsTopProductSchema).optional(),
  quotes: z.object({
    /** all time */
    byStatus: quoteCountsSchema,
    /** created in the range, and where those stand now */
    created: z.number().int().optional(),
    createdByStatus: quoteCountsSchema.optional(),
    /** won / (won + lost) among those; null when none is decided */
    conversionRate: z.number().nullable().optional(),
  }),
  reviews: z.object({
    pending: z.number().int(),
  }),
  /** right now, whatever the range */
  attention: statsAttentionSchema.optional(),
});

export type StatsOverview = z.infer<typeof statsOverviewSchema>;
export type StatsSeriesPoint = z.infer<typeof statsSeriesPointSchema>;
