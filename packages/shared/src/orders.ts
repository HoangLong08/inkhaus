/**
 * The order lifecycle, shared so the back office offers exactly the moves the
 * API will accept.
 *
 * This used to live only in `OrdersService.ALLOWED`. The admin app needs the
 * same table to build its status dropdown, and a second copy would drift the
 * first time a status is added - the admin would offer a transition the API
 * rejects with a 400, or hide a legal one. Same reasoning as the pricing ladder.
 */

export const ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatusCode = (typeof ORDER_STATUSES)[number];

/** which transitions the back office is allowed to make, keyed by current status */
export const ORDER_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["IN_PRODUCTION", "REFUNDED", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** true when `to` is reachable from `from`. Staying put is always allowed. */
export function canTransition(from: OrderStatusCode, to: OrderStatusCode) {
  return from === to || ORDER_TRANSITIONS[from].includes(to);
}
