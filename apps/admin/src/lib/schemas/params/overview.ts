import { z } from "zod";

/**
 * The overview's URL. Empty in the baseline - the page has no controls yet -
 * but it exists so the stats query key is typed by a parsed object from day
 * one, like every other key. The range selector adds its field here.
 */
export const overviewQuerySchema = z.object({});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
