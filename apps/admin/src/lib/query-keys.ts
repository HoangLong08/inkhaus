import type { OrdersQuery, QuotesQuery } from "./schemas/params";

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
 */
export const queryKeys = {
  me: () => ["me"] as const,
  orders: {
    all: () => ["orders"] as const,
    list: (params: OrdersQuery) => ["orders", "list", params] as const,
    detail: (number: string) => ["orders", "detail", number] as const,
  },
  quotes: {
    all: () => ["quotes"] as const,
    list: (params: QuotesQuery) => ["quotes", "list", params] as const,
  },
} as const;
