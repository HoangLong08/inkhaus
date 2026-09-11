import { adminOrderDetailSchema } from "@/lib/schemas/api";
import type { OrderNoteInput, OrderStatusInput, OrderTrackingInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

const orderPath = (number: string) => `/orders/${encodeURIComponent(number)}`;

/**
 * The order detail page's client leaves, through /api/admin/orders/:number.
 * Every call parses the same detail shape the page hydrated, so a write's
 * answer can go straight into the cache.
 */
export const orderClient = {
  get: (number: string) => call(orderPath(number), adminOrderDetailSchema),

  setStatus: (number: string, input: OrderStatusInput) =>
    call(`${orderPath(number)}/status`, adminOrderDetailSchema, json("PATCH", input)),

  addNote: (number: string, input: OrderNoteInput) =>
    call(`${orderPath(number)}/notes`, adminOrderDetailSchema, json("POST", input)),

  setTracking: (number: string, input: OrderTrackingInput) =>
    call(`${orderPath(number)}/tracking`, adminOrderDetailSchema, json("PUT", input)),
};
