import { ORDER_STATUSES } from "@inkhaus/shared/orders";
import { SearchX } from "lucide-react";
import Link from "next/link";

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
  // The schema replaces the hand-rolled guards this page used to carry, and
  // keeps their behaviour: an unknown ?status= is dropped rather than passed to
  // the API, which would answer 400, and a junk ?page= falls back to 1. Every
  // field ends in .catch(), so this cannot throw.
  const params = ordersQuerySchema.parse(await searchParams);
  const { data, meta } = await adminApi.orders(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground text-sm" data-testid="orders-meta">
          {meta.total} total · page {meta.page} of {meta.pages}
        </p>
      </div>

      <OrdersToolbar />

      <StatusFilterLinks base="/orders" statuses={ORDER_STATUSES} active={params.status} />

      {data.length === 0 ? (
        <Card>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No orders match this filter</EmptyTitle>
              <EmptyDescription>
                Try a different status, or clear the customer email.
              </EmptyDescription>
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
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((order) => (
                <TableRow key={order.number} data-testid="order-row" data-number={order.number}>
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
                    {order.items.reduce((n, item) => n + item.quantity, 0)}
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

      <Pager
        base="/orders"
        page={meta.page}
        pages={meta.pages}
        params={{ status: params.status, email: params.email }}
      />
    </div>
  );
}
