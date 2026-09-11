import { useQuery, type QueryClient } from "@tanstack/react-query";

import { ClientApiError, clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import type {
  AdminOrderDetail,
  AdminOrderDetailEvent,
  AdminOrderDetailTracking,
  AdminUser,
} from "@/lib/schemas/api";

/**
 * What every client leaf on the order page shares: one cache entry, prefetched
 * by the page and hydrated through its HydrationBoundary, so none of them
 * fetches on mount. The badge, the timeline, the status form and the tracking
 * card read it, and every form on the page writes it optimistically, which is
 * why a status move shows up in all of them at once.
 */
export function useOrderDetail(number: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(number),
    queryFn: () => clientApi.order.get(number),
  });
}

/**
 * A timeline entry written before the server answers, attributed to whoever is
 * looking at the page. The write's onSuccess replaces the whole entry with the
 * server's version, ids and all, so this only ever lives for one round trip.
 */
export function optimisticEvent(
  kind: AdminOrderDetailEvent["kind"],
  status: AdminOrderDetailEvent["status"],
  note: string | null,
  viewer: AdminUser,
  tracking: AdminOrderDetailTracking | null = null,
): AdminOrderDetailEvent {
  return {
    id: `optimistic-${kind}-${Date.now()}`,
    kind,
    status,
    note,
    at: new Date().toISOString(),
    actor: { id: viewer.id, name: viewer.name, email: viewer.email },
    tracking,
  };
}

/**
 * The `onMutate` half of an optimistic write: stop any refetch that would land
 * on top of it, keep the entry as it was for a rollback, then apply `patch`.
 */
export async function patchOrderDetail(
  queryClient: QueryClient,
  number: string,
  patch: (order: AdminOrderDetail) => AdminOrderDetail,
) {
  const queryKey = queryKeys.orders.detail(number);
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<AdminOrderDetail>(queryKey);
  if (previous) queryClient.setQueryData<AdminOrderDetail>(queryKey, patch(previous));
  return { previous };
}

/** the `onError` half: put back what `patchOrderDetail` kept */
export function restoreOrderDetail(
  queryClient: QueryClient,
  number: string,
  previous: AdminOrderDetail | undefined,
) {
  if (previous) queryClient.setQueryData(queryKeys.orders.detail(number), previous);
}

/**
 * A 401 has already sent the tab to the login page inside clientApi; a toast
 * now would flash at a page that is on its way out.
 */
export function isSessionExpired(error: unknown) {
  return error instanceof ClientApiError && error.status === 401;
}
