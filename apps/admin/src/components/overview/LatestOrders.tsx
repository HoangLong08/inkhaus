import { ArrowRight, PackageOpen } from "lucide-react";
import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { adminApi } from "@/lib/api";
import { on, usd } from "@/lib/format";

export default async function LatestOrders() {
  const recent = await adminApi.orders({ page: 1 });

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
          Latest orders
        </CardTitle>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href="/orders">
            All {recent.meta.total}
            <ArrowRight />
          </Link>
        </Button>
      </CardHeader>

      {recent.data.length === 0 ? (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen />
            </EmptyMedia>
            <EmptyTitle>No orders yet</EmptyTitle>
            <EmptyDescription>
              Orders appear here the moment a customer checks out.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // Still a list, not a Table. This is a six-field summary strip and a
        // table would force a horizontal scroll at the narrowest width anyone
        // actually opens this app at.
        <ul className="divide-y">
          {recent.data.slice(0, 8).map((order) => (
            <li key={order.number}>
              <Link
                href={`/orders/${order.number}`}
                className="hover:bg-accent flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition"
                data-testid="recent-order"
                data-number={order.number}
              >
                <span className="font-mono text-sm font-semibold">{order.number}</span>
                <StatusBadge status={order.status} />
                <span className="text-muted-foreground truncate text-sm">
                  {order.customer.email}
                </span>
                <span className="ml-auto text-sm font-semibold tabular-nums">
                  {usd(order.total)}
                </span>
                <span className="text-muted-foreground w-24 text-right text-xs">
                  {on(order.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
