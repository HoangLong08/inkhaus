import "server-only";

import { canSetStatus } from "@inkhaus/shared/orders";

import { adminApi, type AdminUser, type Order } from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import type { OrderStatusInput } from "@/lib/schemas/forms";

/**
 * Cancelling or refunding is a money decision, not a production step. The order
 * detail page already hides these from staff, so reaching here as staff means
 * the request was hand-made; refuse before the round trip. The API refuses too -
 * that is the check that actually protects the data, and this one exists so a
 * forged request gets a clear 403 instead of a confusing upstream error.
 *
 * The route handler has already checked `orders.advance`; this is the
 * value-level rule no route-level capability can express.
 */
export async function applyOrderStatus(
  user: AdminUser,
  number: string,
  input: OrderStatusInput,
): Promise<Order> {
  if (!canSetStatus(user.role, input.status)) {
    throw new HttpError(403, `Only an owner can move an order to ${input.status}.`);
  }
  return adminApi.order.setStatus(number, { status: input.status, note: input.note || undefined });
}
