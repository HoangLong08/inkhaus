import { ORDER_STATUSES } from "@inkhaus/shared/orders";

import { OrdersTableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZES } from "@/lib/schemas/params";

/**
 * `/orders` while it loads, laid out like the page itself - heading, the
 * toolbar row, a chip per status plus "All", then the table - so nothing jumps
 * when the list lands.
 */
export function OrdersListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-60 flex-1">
            <Skeleton className="h-9 w-full max-w-sm" />
          </div>
          <Skeleton className="h-8 w-36" />
          <div className="flex items-center gap-1">
            {PAGE_SIZES.map((size) => (
              <Skeleton key={size} className="h-7 w-9" />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: ORDER_STATUSES.length + 1 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <OrdersTableSkeleton />
    </div>
  );
}
