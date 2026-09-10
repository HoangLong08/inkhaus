import { orderSchema } from "@/lib/schemas/api";
import type { OrderStatusInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

/** the order detail page's client leaves, through /api/admin/orders/:number */
export const orderClient = {
  get: (number: string) => call(`/orders/${encodeURIComponent(number)}`, orderSchema),

  setStatus: (number: string, input: OrderStatusInput) =>
    call(`/orders/${encodeURIComponent(number)}/status`, orderSchema, json("PATCH", input)),
};
