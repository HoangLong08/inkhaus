import { statsOverviewSchema } from "@/lib/schemas/api";
import type { OverviewQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

export const statsApi = {
  /**
   * `GET /admin/stats/overview` for one range preset - grouped counts and a
   * daily series the database buckets, where the overview used to read five
   * whole lists to get five `meta.total`s. Pages read it through
   * `components/overview/data.ts`, which makes it one call per request.
   */
  overview: (params: Partial<OverviewQuery> = {}) =>
    request(`/admin/stats/overview${query(params)}`, { schema: statsOverviewSchema }),
};
