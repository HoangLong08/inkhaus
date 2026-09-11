"use client";

import { useQuery } from "@tanstack/react-query";

import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The one cache entry every client leaf on the quote page reads. The page
 * prefetches it on the server and wraps the leaves in a HydrationBoundary, so
 * the first render is warm and nothing refetches on mount; a write updates it
 * once and the badge, the pickers and the timeline all move together.
 */
export function useQuoteDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(id),
    queryFn: () => clientApi.quotes.get(id),
  });
}
