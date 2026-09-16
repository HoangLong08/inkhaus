import ListEmpty from "@/components/common/ListEmpty";
import { PackageOpen } from "lucide-react";
import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerOrderRow } from "@/lib/api";
import { count, on, usd } from "@/lib/format";
import { hrefWith } from "@/lib/url";

/**
 * The customer's latest orders. The full history is the orders list itself,
 * searched by their address - one list to filter and sort, not a second copy of
 * it here.
 */
export default function CustomerOrders({
  orders,
  email,
  orderCount,
}: {
  orders: CustomerOrderRow[];
  email: string;
  orderCount: number;
}) {
  if (orders.length === 0) {
    return (
      <ListEmpty
        icon={PackageOpen}
        title="No orders yet"
        description="Nothing has been ordered under this address."
        reason="none"
      />
    );
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Placed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.number}
              data-testid="customer-order-row"
              data-number={order.number}
              data-status={order.status}
            >
              <TableCell>
                <Button asChild variant="link" size="sm" className="h-auto p-0 font-mono">
                  <Link href={`/orders/${order.number}`} data-testid="customer-order-link">
                    {order.number}
                  </Link>
                </Button>
              </TableCell>
              <TableCell>
                <StatusBadge status={order.status} />
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {order.units}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {usd(order.total)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-xs">
                {order.placedAt ? on(order.placedAt) : "Draft"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CardFooter className="bg-muted/50 justify-between gap-2 border-t px-4 py-2.5">
        <p className="text-muted-foreground text-xs">
          {count(orderCount)} placed {orderCount === 1 ? "order" : "orders"} in total
        </p>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={hrefWith("/orders", {}, { q: email })} data-testid="customer-orders-all">
            All orders
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
