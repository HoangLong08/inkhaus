import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";

import { ClientApiError } from "./client-api";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Above zero on purpose. Every list page prefetches on the server and
        // hydrates; with the default of 0 the client would consider that data
        // stale the moment it mounted and fetch it all again, doubling the cost
        // of every page load to gain nothing.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // A back office tab sits open all day, so coming back to it is exactly
        // when the numbers on screen are most likely to be out of date.
        refetchOnWindowFocus: true,
        // A 401, 403 or 404 from the BFF is an answer, not a hiccup; retrying it
        // just delays the error the operator needs to see.
        retry: (failureCount, error) =>
          error instanceof ClientApiError && error.status < 500 ? false : failureCount < 2,
      },
      dehydrate: {
        // lets a prefetch that is still in flight stream to the client rather
        // than blocking the server render until it lands
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * On the server, a fresh client per request: a shared one would leak one
 * operator's orders into another's render. In the browser, a singleton, so a
 * suspended render does not throw the cache away halfway through.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
