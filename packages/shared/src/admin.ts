/**
 * Who may do what in the back office.
 *
 * One table, enforced three times: the admin UI hides a control with `can()`,
 * the admin's route handler refuses it with a 403, and the API refuses it again
 * through `@Can(action)`. All three read this file, which is the only reason
 * they cannot disagree. Removing any one of them is a security change, not a
 * refactor.
 *
 * `canSetStatus` in `./orders` stays as the value-level rule for order
 * statuses: cancelling and refunding share an endpoint with every other move,
 * so no route-level capability can express them.
 *
 * Dependency-free and browser-safe - the admin sidebar imports it.
 */
import type { AdminRoleCode } from "./orders";

const EVERYONE = ["OWNER", "STAFF"] as const;
const OWNERS = ["OWNER"] as const;

export const ADMIN_CAPABILITIES = {
  "stats.view": EVERYONE,
  "orders.view": EVERYONE,
  "orders.advance": EVERYONE,
  "orders.note": EVERYONE,
  "orders.tracking": EVERYONE,
  "quotes.manage": EVERYONE,
  "quotes.convert": EVERYONE,
  "customers.view": EVERYONE,
  "customers.edit": EVERYONE,
  "catalog.view": EVERYONE,
  "catalog.edit": EVERYONE,
  "reviews.moderate": EVERYONE,

  /** a bulk export of personal data */
  "orders.export": OWNERS,
  /** customer artwork, including designs never ordered */
  "designs.view": OWNERS,
  /** price, bulk price, size upcharges and the tier ladder - money */
  "catalog.price": OWNERS,
  /** a new blank carries a price, so creating one is a price decision */
  "catalog.create": OWNERS,
  "reviews.delete": OWNERS,
  "staff.view": OWNERS,
  "staff.manage": OWNERS,
} as const satisfies Record<string, readonly AdminRoleCode[]>;

export type AdminAction = keyof typeof ADMIN_CAPABILITIES;

export const ADMIN_ACTIONS = Object.keys(ADMIN_CAPABILITIES) as AdminAction[];

/** true when `role` may perform `action` */
export function can(role: AdminRoleCode, action: AdminAction): boolean {
  return (ADMIN_CAPABILITIES[action] as readonly AdminRoleCode[]).includes(role);
}

// ------------------------------------------------------------------- staff

export type StaffChangeErrorCode = "NOT_OWNER" | "SELF" | "LAST_OWNER";

export type StaffChangeError = { code: StaffChangeErrorCode; message: string };

/**
 * Why a staff change is not allowed, or null when it is. Shared so the staff
 * screen can disable a control with the same sentence the API would refuse it
 * with.
 *
 * - only an owner manages staff
 * - nobody changes their own role or deactivates themselves - that is how an
 *   office ends up with no owner at 6pm on a Friday
 * - the last active owner can be neither demoted nor deactivated
 *
 * `activeOwners` is the count *before* the change.
 */
export function staffChangeError(
  actor: { id: string; role: AdminRoleCode },
  target: { id: string; role: AdminRoleCode; isActive: boolean },
  change: { role?: AdminRoleCode; isActive?: boolean },
  activeOwners: number,
): StaffChangeError | null {
  if (actor.role !== "OWNER") {
    return { code: "NOT_OWNER", message: "Only an owner can manage staff." };
  }

  const changesRole = change.role !== undefined && change.role !== target.role;
  const deactivates = change.isActive === false && target.isActive;

  if (actor.id === target.id && (changesRole || change.isActive === false)) {
    return {
      code: "SELF",
      message: "You cannot change your own role or deactivate yourself.",
    };
  }

  const losesAnOwner =
    target.role === "OWNER" && target.isActive && ((changesRole && change.role !== "OWNER") || deactivates);
  if (losesAnOwner && activeOwners <= 1) {
    return { code: "LAST_OWNER", message: "At least one active owner must remain." };
  }

  return null;
}

// ----------------------------------------------------------------- reviews

export const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;

export type ReviewStatusCode = (typeof REVIEW_STATUSES)[number];

/** how many reviews one bulk action may touch */
export const REVIEW_BULK_MAX = 50;

// --------------------------------------------------------------- customers

export const CUSTOMER_SORTS = [
  "created_desc",
  "created_asc",
  "name_asc",
  "orders_desc",
  "login_desc",
] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const CUSTOMER_NOTE_MAX = 2000;

// ----------------------------------------------------------------- catalog

export const PRODUCT_SORTS = [
  "sort_asc",
  "name_asc",
  "price_asc",
  "price_desc",
  "updated_desc",
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_ACTIVE_FILTERS = ["all", "active", "archived"] as const;

export type ProductActiveFilter = (typeof PRODUCT_ACTIVE_FILTERS)[number];

// ------------------------------------------------------------------- stats

export const STATS_RANGES = ["7d", "30d", "90d", "365d"] as const;

export type StatsRange = (typeof STATS_RANGES)[number];

export const STATS_RANGE_DAYS: Record<StatsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};
