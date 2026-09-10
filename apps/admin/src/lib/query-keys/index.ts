import { catalogKeys } from "./catalog";
import { customersKeys } from "./customers";
import { ordersKeys } from "./orders";
import { quotesKeys } from "./quotes";
import { reviewsKeys } from "./reviews";
import { staffKeys } from "./staff";
import { statsKeys } from "./stats";

/**
 * Never write a key inline. An invalidation that misses by one character fails
 * silently - the mutation succeeds, nothing refetches, and the stale number on
 * screen looks like a caching bug rather than a typo.
 *
 * The rule that makes hydration work: the params object handed to a `list` key
 * must be the zod-PARSED one on both sides. A server page parses searchParams,
 * builds the key from the result, and passes that same object down as a prop;
 * the client builds an identical key from it. Params assembled by hand on either
 * side are the usual cause of "prefetched, then immediately refetched".
 *
 * Every key starts with its feature's `all()` prefix, so invalidating `all()`
 * reaches every list and detail under it.
 *
 * FROZEN after Phase 0: every key the back office will need is declared here
 * already. A feature changes the params TYPE its key takes in its own file.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  orders: ordersKeys,
  quotes: quotesKeys,
  customers: customersKeys,
  catalog: catalogKeys,
  reviews: reviewsKeys,
  staff: staffKeys,
  stats: statsKeys,
} as const;
