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

// ----------------------------------------------------------- bulk quotes

/**
 * The other lifecycle the back office drives. It lives beside the order one
 * rather than in a file of its own because the two are always needed together -
 * the sidebar lists both, and a client bundle should not pay for two imports to
 * get four strings.
 *
 * There is no transition table: a quote may move anywhere at any time. Triage is
 * a human changing their mind, not a production line.
 */
export const QUOTE_STATUSES = ["NEW", "CONTACTED", "WON", "LOST"] as const;

export type QuoteStatusCode = (typeof QUOTE_STATUSES)[number];

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

// ------------------------------------------------------------ the timeline

/**
 * What an order event records. STATUS and TRACKING are the customer's own
 * history and show on the public order page; NOTE is staff talking to staff and
 * never leaves the back office. Who made a change is never public either.
 */
export const ORDER_EVENT_KINDS = ["STATUS", "NOTE", "TRACKING"] as const;

export type OrderEventKindCode = (typeof ORDER_EVENT_KINDS)[number];

export const PUBLIC_ORDER_EVENT_KINDS: readonly OrderEventKindCode[] = ["STATUS", "TRACKING"];

/** a note on a status move - shown to the customer */
export const ORDER_NOTE_MAX = 500;

/** an internal note - staff only */
export const ORDER_INTERNAL_NOTE_MAX = 1000;

/** the statuses that count as money in: paid and not given back */
export const REVENUE_STATUSES: OrderStatusCode[] = ["PAID", "IN_PRODUCTION", "SHIPPED", "DELIVERED"];

export const ORDER_SORTS = [
  "placed_desc",
  "placed_asc",
  "total_desc",
  "total_asc",
  "number_desc",
  "number_asc",
] as const;

export type OrderSort = (typeof ORDER_SORTS)[number];

// ---------------------------------------------------------------- shipping

export const CARRIERS = ["USPS", "UPS", "FEDEX", "DHL", "OTHER"] as const;

export type CarrierCode = (typeof CARRIERS)[number];

export const CARRIER_LABEL: Record<CarrierCode, string> = {
  USPS: "USPS",
  UPS: "UPS",
  FEDEX: "FedEx",
  DHL: "DHL",
  OTHER: "Other",
};

export const TRACKING_NUMBER_MAX = 64;

/** letters, digits, spaces and dashes - what every carrier above prints */
export const TRACKING_NUMBER_PATTERN = /^[A-Za-z0-9 -]{4,64}$/;

/** the carrier's public tracking page, or null when we do not know one */
export function trackingUrl(carrier: CarrierCode, number: string): string | null {
  const n = encodeURIComponent(number.trim());
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "FEDEX":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "DHL":
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`;
    default:
      return null;
  }
}

/**
 * An order cannot be marked shipped without saying how. The customer is told
 * their tracking number arrives by email, and a SHIPPED order with nothing to
 * send is a support ticket waiting to happen.
 */
export function requiresTracking(to: OrderStatusCode) {
  return to === "SHIPPED";
}

// ---------------------------------------------------------- quote workflow

export const QUOTE_EVENT_KINDS = ["STATUS", "NOTE", "ASSIGNED", "FOLLOW_UP", "CONVERTED"] as const;

export type QuoteEventKindCode = (typeof QUOTE_EVENT_KINDS)[number];

export const QUOTE_NOTE_MAX = 1000;

export const QUOTE_SORTS = ["created_desc", "created_asc", "followup_asc", "quantity_desc"] as const;

export type QuoteSort = (typeof QUOTE_SORTS)[number];

/**
 * Quotes still move freely - with one exception. Once a quote has become an
 * order it is WON for good: marking it LOST would leave a live order pointing
 * at a quote that says the deal fell through.
 */
export function canSetQuoteStatus(
  quote: { convertedOrderId: string | null },
  to: QuoteStatusCode,
) {
  return !quote.convertedOrderId || to === "WON";
}

/** a quote becomes an order at most once, and never from LOST */
export function canConvertQuote(quote: { status: QuoteStatusCode; convertedOrderId: string | null }) {
  return !quote.convertedOrderId && quote.status !== "LOST";
}
