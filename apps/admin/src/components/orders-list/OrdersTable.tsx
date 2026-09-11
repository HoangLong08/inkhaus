import type { OrderSort } from "@inkhaus/shared/orders";
import Link from "next/link";

import SortableHead from "@/components/common/SortableHead";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminOrderListItem } from "@/lib/api";
import { on, usd } from "@/lib/format";
import type { Params } from "@/lib/url";

/**
 * The orders table. Server-rendered: every row is a pure function of the URL.
 *
 * The whole row opens the order, through one real link - the order number -
 * whose `::after` is stretched over the row (`relative` on the `<tr>`,
 * `absolute inset-0` on the pseudo-element). It stays a single tab stop with a
 * real href, so middle-click and "open in new tab" work, which a row with an
 * onClick never manages. The customer's email is the one other link in the
 * row; `relative z-10` lifts it above the stretched one.
 *
 * Order, Total and Placed sort by being links too (`SortableHead`).
 */
export default function OrdersTable({
  orders,
  sort,
  linkParams,
}: {
  orders: AdminOrderListItem[];
  sort: OrderSort;
  linkParams: Params;
}) {
  const head = { base: "/orders", params: linkParams, sort };

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead {...head} field="number" label="Order" />
            <TableHead>Status</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <SortableHead {...head} field="total" label="Total" align="right" />
            <SortableHead {...head} field="placed" label="Placed" align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.number}
              className="relative"
              data-testid="order-row"
              data-number={order.number}
              data-status={order.status}
              data-total={order.total}
            >
              <TableCell>
                <Link
                  href={`/orders/${order.number}`}
                  data-testid="order-row-link"
                  className="focus-visible:after:ring-ring/50 font-mono font-semibold underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-[3px] focus-visible:after:ring-inset"
                >
                  {order.number}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={order.status} />
              </TableCell>
              <TableCell className="max-w-64">
                <Link
                  href={`/customers/${order.customer.id}`}
                  // secondary to the row's own link; a page of 100 rows need
                  // not prefetch 100 customer pages as well
                  prefetch={false}
                  data-testid="order-customer-link"
                  data-customer-id={order.customer.id}
                  className="text-muted-foreground hover:text-foreground relative z-10 inline-block max-w-full truncate align-bottom underline-offset-4 hover:underline"
                >
                  {order.customer.email}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {order.units}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {usd(order.total)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-xs">
                {/* a draft has not been placed; say which date this is */}
                {order.placedAt ? on(order.placedAt) : `Created ${on(order.createdAt)}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
