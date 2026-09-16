import ListPage from "@/components/common/ListPage";
import { OrdersKpiStripSkeleton } from "@/components/orders-list/OrdersKpiStrip";
import { ListFooterSkeleton, OrdersTableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/orders` while it loads, laid out like the page itself - heading and its
 * description, the queue strip, the toolbar row, the table, then the footer - so
 * nothing jumps when the list lands.
 *
 * The one thing it cannot mirror is `?cols=`: `loading.tsx` is handed no
 * searchParams, so the table skeleton always draws the full column set. A narrow
 * `?cols=` costs one frame of reflow, which is the cheapest of the options here.
 */
export function OrdersListSkeleton() {
  return (
    <ListPage>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Skeleton className="h-7 w-40" />
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <Skeleton className="h-3 w-80" />
          <Skeleton className="h-3.5 w-48" />
        </div>
      </div>

      <OrdersKpiStripSkeleton />

      {/* the same two groups the real toolbar splits into */}
      <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-64" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <OrdersTableSkeleton />
      <ListFooterSkeleton />
    </ListPage>
  );
}
