import "server-only";

import { canSetStatus } from "@inkhaus/shared/orders";

import { adminApi, type AdminOrderDetail, type AdminUser } from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import type { OrderNoteInput, OrderStatusInput, OrderTrackingInput } from "@/lib/schemas/forms";

/**
 * Cancelling or refunding is a money decision, not a production step. The order
 * detail page already hides these from staff, so reaching here as staff means
 * the request was hand-made; refuse before the round trip. The API refuses too -
 * that is the check that actually protects the data, and this one exists so a
 * forged request gets a clear 403 instead of a confusing upstream error.
 *
 * The route handler has already checked `orders.advance`; this is the
 * value-level rule no route-level capability can express. Whether SHIPPED has
 * the tracking it needs depends on what is already on the order, which only the
 * API knows at the instant it writes - so that one is the API's alone.
 */
export async function applyOrderStatus(
  user: AdminUser,
  number: string,
  input: OrderStatusInput,
): Promise<AdminOrderDetail> {
  if (!canSetStatus(user.role, input.status)) {
    throw new HttpError(403, `Only an owner can move an order to ${input.status}.`);
  }
  return adminApi.order.setStatus(number, input);
}

/**
 * An internal note has no rule beyond `orders.note`, which the route handler
 * checks. It lives here anyway so the note has exactly one way in, like every
 * other write.
 */
export async function addOrderNote(number: string, input: OrderNoteInput): Promise<AdminOrderDetail> {
  return adminApi.order.addNote(number, input);
}

/**
 * `orders.tracking` is checked by the route handler. Whether the order is in a
 * state that takes tracking (in production, shipped or delivered) is decided by
 * the API against the status as it stands when it writes; the page only hides
 * the form, which a stale tab could get wrong.
 */
export async function setOrderTracking(
  number: string,
  input: OrderTrackingInput,
): Promise<AdminOrderDetail> {
  return adminApi.order.setTracking(number, input);
}
