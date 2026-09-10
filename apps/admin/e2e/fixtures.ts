/**
 * What `apps/api/prisma/seed-e2e.ts` builds before every run (global-setup runs
 * it), so a spec can name its subject instead of hunting for one.
 *
 * Mirrored BY HAND in that file: the API cannot import from an app's test
 * folder, and this folder must not import from the API. Change one, change the
 * other.
 *
 * Every fixture is rebuilt on each run, which is what makes it safe for a test
 * to edit, spend or delete one. Nothing else in the database is written by the
 * seed - a test that needs "an order" and not one of these should read
 * `data-number` off the list instead.
 */

/** the one STAFF account. Role, active flag and name are reset every run. */
export const STAFF_EMAIL = "e2e-staff@inkhaus.test";
/** staff.spec invites addresses with this prefix; the seed deletes them */
export const INVITEE_PREFIX = "e2e-invitee";

/** SHIPPED, under the storefront's test shopper. The web suite asserts it - leave it alone. */
export const SHOPPER_ORDER = "INK-900001";

/**
 * PENDING_PAYMENT orders for status tests to spend. The transition table has no
 * way back, so the seed rebuilds all six every run. Take one through
 * `findActionableOrder`, which prefers these.
 */
export const POOL = [
  "INK-900101",
  "INK-900102",
  "INK-900103",
  "INK-900104",
  "INK-900105",
  "INK-900106",
] as const;
export const POOL_EMAIL = "e2e-pool@inkhaus.test";

/** a customer with a saved design and three orders; name, phone, company and note reset every run */
export const CUSTOMER_EMAIL = "e2e-customer@inkhaus.test";
export const CUSTOMER_NAME = "E2E Customer";
export const CUSTOMER_COMPANY = "Ridgeline FC";
export const CUSTOMER_PHONE = "555-0100";
/** owned by CUSTOMER_EMAIL; its front preview is a real 1x1 PNG, its back is empty */
export const DESIGN_ID = "e2e-design-01";

/** PAID, one line linked to DESIGN_ID: M x3 and 2XL x2, the 2XL carrying a 2.00 upcharge */
export const ORDER_PAID = "INK-900002";
/** IN_PRODUCTION with no tracking yet - shipping it has to supply some */
export const ORDER_IN_PRODUCTION = "INK-900003";
/** DELIVERED via UPS, placed on ORDER_DELIVERED_DAY - the date filter's target */
export const ORDER_DELIVERED = "INK-900004";
/** UTC day INK-900004 was placed on, as the URL's `from`/`to` spell it */
export const ORDER_DELIVERED_DAY = "2026-08-15";
/** order totals in USD, as seeded */
export const ORDER_TOTALS = {
  [ORDER_PAID]: 120,
  [ORDER_IN_PRODUCTION]: 374.4,
  [ORDER_DELIVERED]: 238.4,
} as const;
/** all three of the customer's orders are revenue statuses */
export const CUSTOMER_LIFETIME_VALUE = 732.8;

/** NEW, 120 units of QUOTE_PRODUCT by DTG, from QUOTE_COMPANY */
export const QUOTE_NEW_EMAIL = "e2e-quote-new@inkhaus.test";
/** CONTACTED, assigned to STAFF_EMAIL, follow-up two days overdue */
export const QUOTE_CONTACTED_EMAIL = "e2e-quote-contacted@inkhaus.test";
/** NEW, 48 units. quotes.spec converts it; the next seed deletes the order it made */
export const QUOTE_CONVERT_EMAIL = "e2e-quote-convert@inkhaus.test";
export const QUOTE_COMPANY = "E2E Athletics";
/** every quote fixture is for this product */
export const QUOTE_PRODUCT = "heavyweight-tee";

/** every fixture review's author starts with this; the seed deletes and recreates them */
export const REVIEW_AUTHOR_PREFIX = "E2E ";
/** ratings 5, 4 and 2 are the PENDING ones */
export const REVIEW_COUNTS = { PENDING: 3, PUBLISHED: 1, REJECTED: 1 } as const;

/**
 * Archived, and reset in full every run: price 20, bulk 9, DTG only, white and
 * black, default size run, sort order 999.
 */
export const TEST_PRODUCT = "e2e-test-blank";
/** archived colour "E2E Teal", #1A7F7A; name, hex and active flag reset every run */
export const TEST_COLOR = "e2e-teal";
/** never seeded: catalog.spec creates and deletes it, the seed removes a leftover */
export const TEST_SIZE = "E2E";
