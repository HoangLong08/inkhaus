import { catalogOptionsSchema, staffDirectorySchema } from "@/lib/schemas/api";

import { request } from "./core";

/**
 * Reference lists several screens share. FROZEN after Phase 0.
 */
export const lookupsApi = {
  /** active admins - quote assignees, filter options; needs `orders.view` */
  staffDirectory: () => request("/admin/staff/directory", { schema: staffDirectorySchema }),

  /** active products with their methods, sizes and colours, plus the live ladder */
  catalogOptions: () => request("/admin/catalog/options", { schema: catalogOptionsSchema }),
};
