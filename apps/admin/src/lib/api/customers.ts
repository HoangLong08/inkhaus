import {
  customerDesignListSchema,
  customerDetailSchema,
  customerListSchema,
} from "@/lib/schemas/api";
import type { CustomerEditInput } from "@/lib/schemas/forms";
import type { CustomersQuery } from "@/lib/schemas/params";

import { query, request } from "./core";

const path = (id: string) => `/admin/customers/${encodeURIComponent(id)}`;

export const customersApi = {
  /** `GET /admin/customers` - the page's parsed params, or any subset of them */
  list: (params: Partial<CustomersQuery> = {}) =>
    request(`/admin/customers${query(params)}`, { schema: customerListSchema }),

  get: (id: string) => request(path(id), { schema: customerDetailSchema }),

  update: (id: string, input: CustomerEditInput) =>
    request(path(id), { method: "PATCH", body: input, schema: customerDetailSchema }),

  /**
   * The customer's saved designs, newest first - labels and which sides can be
   * drawn, never the artwork. `designs.view` (owners only), so call it only for
   * a viewer who has it; a staff token gets a 403.
   */
  designs: (customerId: string) =>
    request(`/admin/designs${query({ customerId })}`, { schema: customerDesignListSchema }),
};
