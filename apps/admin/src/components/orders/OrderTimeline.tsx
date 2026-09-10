"use client";

import { useQuery } from "@tanstack/react-query";

import StatusBadge from "@/components/StatusBadge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { clientApi } from "@/lib/client-api";
import { at } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/**
 * One of three small client leaves on the order page, all reading the same cache
 * entry the server prefetched. Keeping them separate rather than making the
 * whole page a client component means the browser downloads a timeline renderer
 * and a badge, not a full order renderer - everything else here (line items,
 * prices, the shipping address) cannot change from this screen.
 */
export default function OrderTimeline({ number }: { number: string }) {
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(number),
    queryFn: () => clientApi.order.get(number),
  });

  // warm from the page's HydrationBoundary; the guard is for the type
  if (!order) return null;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="bg-muted/50 border-b px-4 py-2.5">
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Timeline
        </CardTitle>
      </CardHeader>
      <ol className="divide-y" data-testid="order-timeline">
        {order.timeline.map((event, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
            <StatusBadge status={event.status} />
            {event.note ? <span className="text-muted-foreground">{event.note}</span> : null}
            <span className="text-muted-foreground ml-auto text-xs">{at(event.at)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
