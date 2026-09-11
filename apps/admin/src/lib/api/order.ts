import { adminDesignPreviewSchema, adminOrderDetailSchema } from "@/lib/schemas/api";
import type { OrderNoteInput, OrderStatusInput, OrderTrackingInput } from "@/lib/schemas/forms";

import { request } from "./core";

const orderPath = (number: string) => `/admin/orders/${encodeURIComponent(number)}`;

/**
 * One order, through the admin endpoints. Every write answers with the whole
 * detail - the same shape `get` parses - so the page's cache entry is replaced
 * with the server's version in one step.
 */
export const orderApi = {
  get: (number: string) => request(orderPath(number), { schema: adminOrderDetailSchema }),

  setStatus: (number: string, input: OrderStatusInput) =>
    request(`${orderPath(number)}/status`, {
      method: "PATCH",
      body: input,
      schema: adminOrderDetailSchema,
    }),

  addNote: (number: string, input: OrderNoteInput) =>
    request(`${orderPath(number)}/notes`, {
      method: "POST",
      body: input,
      schema: adminOrderDetailSchema,
    }),

  setTracking: (number: string, input: OrderTrackingInput) =>
    request(`${orderPath(number)}/tracking`, {
      method: "PUT",
      body: input,
      schema: adminOrderDetailSchema,
    }),

  /** JSON with both data-URL previews - only the preview route handler reads it */
  designPreview: (publicId: string) =>
    request(`/admin/designs/${encodeURIComponent(publicId)}/preview`, {
      schema: adminDesignPreviewSchema,
    }),
};
