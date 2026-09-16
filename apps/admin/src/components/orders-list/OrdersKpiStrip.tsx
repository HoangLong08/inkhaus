import { ORDER_STATUSES } from "@inkhaus/shared/orders";
import { Layers } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { statusColor, statusIcon } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api";
import { count, humanize } from "@/lib/format";
import { hrefWith, type Params } from "@/lib/url";

/**
 * The queue strip above the orders list: how many orders sit in each status, and
 * one click to see them. It is the status filter - it replaces the row of chips
 * `/orders` used to carry, which is why each segment keeps the chips' test hooks
 * (`status-filter`, `data-status`, `aria-current`) and adds `data-count`.
 *
 * **One flat row, label and number on the same line.** These nine numbers are
 * glanced at, not studied: a stack of label-over-number tiles costs about 110px
 * of the fold for nine figures nobody reads twice, where this costs about 36 and
 * gives the rest back to the table.
 *
 * **The numbers are all-time, the way the overview's tiles are.** With a search
 * or a date range applied the strip still reports the whole queue, so it will not
 * agree with the row count below it - it answers "what is waiting on us", not
 * "what did this filter match". The list's own total stays in the heading's meta
 * line. Making it agree would mean the API returning counts scoped to the current
 * filter, which is an API change, not a UI one.
 *
 * Every href is built with `hrefWith` from the page's parsed params, so clicking a
 * segment keeps the search, the dates, the sort, the page size and the visible
 * columns. A literal `?status=PAID` here would throw all of them away - the exact
 * bug the shared controls exist to prevent.
 */

/** wraps below xl, so the row rule stays until the strip is certainly one line */
const SEGMENT =
  "flex min-w-[50%] flex-1 items-center gap-1.5 border-r border-b px-3 py-1.5 last:border-r-0 sm:min-w-[130px] xl:border-b-0";

// rounded-xl: 11px under the font-size ladder, which is the radius the design
// this follows actually renders on its strip - a step above the table's card
const SHELL = "bg-card flex shrink-0 flex-wrap items-stretch overflow-hidden rounded-xl border";

export default async function OrdersKpiStrip({
  active,
  linkParams,
}: {
  /** the status the list is filtered by, if any */
  active?: string;
  /** the page's params as its links carry them - see `ordersLinkParams` */
  linkParams: Params;
}) {
  const stats = await adminApi.stats.overview();
  const byStatus = stats.orders.byStatus;
  const total = ORDER_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);

  const segments = [
    { value: undefined, label: "All orders", icon: Layers, color: "text-muted-foreground", total },
    ...ORDER_STATUSES.map((status) => ({
      value: status,
      label: humanize(status),
      icon: statusIcon(status),
      color: statusColor(status),
      total: byStatus[status] ?? 0,
    })),
  ];

  return (
    <nav aria-label="Filter orders by status" className={SHELL}>
      {segments.map(({ value, label, icon: Icon, color, total: n }) => {
        const isActive = value === active;
        const key = value ?? "ALL";

        return (
          <Link
            key={key}
            href={hrefWith("/orders", linkParams, { status: value })}
            aria-current={isActive ? "page" : undefined}
            data-testid="status-filter"
            data-param="status"
            data-value={key}
            data-status={key}
            data-count={n}
            className={cn(SEGMENT, "hover:bg-accent transition", isActive && "bg-accent")}
          >
            {Icon ? <Icon className={cn("size-3.5 shrink-0", color)} aria-hidden /> : null}
            {/* text-xs, not the 11px literal this used to carry: that was a
                hand-made step below a 12px text-xs, and under the font-size
                ladder it lands at 9.6px. The ladder does that shrinking now. */}
            <span className="text-muted-foreground truncate text-xs">{label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{count(n)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** the strip's shape while the stats call is in flight */
export function OrdersKpiStripSkeleton() {
  return (
    <div className={SHELL}>
      {Array.from({ length: ORDER_STATUSES.length + 1 }, (_, i) => (
        <div key={i} className={SEGMENT}>
          <Skeleton className="size-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-4 w-6" />
        </div>
      ))}
    </div>
  );
}
