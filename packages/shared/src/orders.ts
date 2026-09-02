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

// ------------------------------------------------------------ authorization

export const ADMIN_ROLES = ["OWNER", "STAFF"] as const;

export type AdminRoleCode = (typeof ADMIN_ROLES)[number];

/**
 * Cancelling or refunding is a money decision, not a production step, so it is
 * kept to owners. These are values rather than routes - both live on the same
 * `PATCH /orders/:number/status` endpoint - which is why the check cannot be a
 * plain route guard and lives here instead, shared by the API that enforces it
 * and the dropdown that must not offer what the API will reject.
 */
export const OWNER_ONLY_ORDER_STATUSES: OrderStatusCode[] = ["CANCELLED", "REFUNDED"];

/** true when `role` is allowed to move an order into `to` */
export function canSetStatus(role: AdminRoleCode, to: OrderStatusCode) {
  return role === "OWNER" || !OWNER_ONLY_ORDER_STATUSES.includes(to);
}
