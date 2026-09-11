import { customerDetailSchema } from "@/lib/schemas/api";
import type { CustomerEditInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

const path = (id: string) => `/customers/${encodeURIComponent(id)}`;

/** the customer profile's client leaves, through /api/admin/customers/:id */
export const customersClient = {
  get: (id: string) => call(path(id), customerDetailSchema),

  update: (id: string, input: CustomerEditInput) =>
    call(path(id), customerDetailSchema, json("PATCH", input)),
};
