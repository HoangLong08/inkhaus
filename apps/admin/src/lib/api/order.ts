import { orderSchema } from "@/lib/schemas/api";
import type { OrderStatusInput } from "@/lib/schemas/forms";

import { request } from "./core";

/**
 * One order. Still the LEGACY endpoints (`/orders/:number`) - the order detail
 * workstream moves these to `/admin/orders/:number`.
 */
export const orderApi = {
  get: (number: string) =>
    request(`/orders/${encodeURIComponent(number)}`, { schema: orderSchema }),

  setStatus: (number: string, input: OrderStatusInput) =>
    request(`/orders/${encodeURIComponent(number)}/status`, {
      method: "PATCH",
      body: { status: input.status, ...(input.note ? { note: input.note } : {}) },
      schema: orderSchema,
    }),
};
