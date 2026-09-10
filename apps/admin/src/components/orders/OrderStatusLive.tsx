"use client";

import { useQuery } from "@tanstack/react-query";

import StatusBadge from "@/components/StatusBadge";
import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The badge beside the order number, client-side only so that it moves the
 * instant the status form fires - it reads the very cache entry the form writes
 * optimistically.
 */
export default function OrderStatusLive({ number }: { number: string }) {
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(number),
    queryFn: () => clientApi.order.get(number),
  });

  // The page prefetched this key and wrapped us in a HydrationBoundary, so the
  // cache is warm on the first render. This guard satisfies the type; it is not
  // a state that occurs.
  if (!order) return null;

  return <StatusBadge status={order.status} />;
}
