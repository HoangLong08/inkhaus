import { statsOverviewSchema } from "@/lib/schemas/api";
import type { OverviewQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

export const statsApi = {
  /**
   * `GET /admin/stats/overview` - one groupBy per table, where the overview
   * used to read five whole lists to get five `meta.total`s.
   */
  overview: (params: Partial<OverviewQuery> = {}) =>
    request(`/admin/stats/overview${query(params)}`, { schema: statsOverviewSchema }),
};
