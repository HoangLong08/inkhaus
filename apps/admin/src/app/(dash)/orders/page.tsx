import { ORDER_STATUSES } from "@inkhaus/shared/orders";
import { SearchX } from "lucide-react";
import Link from "next/link";

import ListHeader from "@/components/common/ListHeader";
import OrdersToolbar from "@/components/orders/OrdersToolbar";
import Pager from "@/components/Pager";
import StatusBadge from "@/components/StatusBadge";
import StatusFilterLinks from "@/components/StatusFilterLinks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/api";
import { on, usd } from "@/lib/format";
import { ordersQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Orders — INKHAUS Back Office" };

/**
 * Fully server rendered: the table is a pure projection of the URL, so there is
 * nothing here for a client cache to hold that the server does not already know.
 * Only the search box is a client component, and it navigates rather than
 * fetches.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Every field ends in .catch(), so this cannot throw: an unknown ?status= is
  // dropped rather than passed to the API, a junk ?page= falls back to 1, and a
  // legacy ?email= is read as the free-text q.
  const params = ordersQuerySchema.parse(await searchParams);
  const { data, meta } = await adminApi.orders.list(params);

  return (
    <div className="space-y-6">
      <ListHeader
        title="Orders"
        meta={`${meta.total} total · page ${meta.page} of ${meta.pages}`}
        metaTestId="orders-meta"
      />

      <OrdersToolbar />

      <StatusFilterLinks
        base="/orders"
        statuses={ORDER_STATUSES}
        active={params.status}
        params={params}
      />

      {data.length === 0 ? (
        <Card>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No orders match this filter</EmptyTitle>
              <EmptyDescription>Try a different status, or clear the search.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((order) => (
                <TableRow
                  key={order.number}
                  data-testid="order-row"
                  data-number={order.number}
                  data-status={order.status}
                  data-total={order.total}
                >
                  <TableCell>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 font-mono">
                      <Link href={`/orders/${order.number}`}>{order.number}</Link>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate">
                    {order.customer.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {order.units}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {usd(order.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs">
                    {on(order.placedAt ?? order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pager base="/orders" page={meta.page} pages={meta.pages} params={params} />
    </div>
  );
}
