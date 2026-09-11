import { STATS_RANGES } from "@inkhaus/shared/admin";
import { z } from "zod";

const overviewQueryShape = z.object({
  /** no `?range=`, or one the page does not offer, is the API's own default */
  range: z.enum(STATS_RANGES).catch("30d"),
});

/**
 * The overview's URL: which window the revenue figures, the chart, the top
 * products and the quote funnel cover. Presets only - a hand-typed
 * `?range=14d` reads as the default instead of reaching the API as a 400. The
 * queue tiles and the attention list are "right now" and ignore it.
 *
 * The field has its own `.catch()`; the outer one only covers input that is not
 * an object at all, so `.parse()` still cannot throw.
 */
export const overviewQuerySchema = overviewQueryShape.catch(() => overviewQueryShape.parse({}));

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
