import "server-only";

import type { StatsRange } from "@inkhaus/shared/admin";
import { cache } from "react";

import { adminApi } from "@/lib/api";
import type { OverviewQuery } from "@/lib/schemas/params";

/**
 * Keyed on the range string, not the params object: `cache` compares its
 * arguments by identity, so two sections handed equal-but-distinct objects
 * would each make the call.
 */
const overviewFor = cache((range: StatsRange) => adminApi.stats.overview({ range }));

/**
 * The stats every overview section reads - one API call per request, however
 * many Suspense boundaries await it. `cache` is scoped to the request, so
 * nothing here outlives it.
 */
export const getOverview = (params: OverviewQuery) => overviewFor(params.range);
