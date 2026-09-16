import type { OrderSort } from "@inkhaus/shared/orders";
import { cn } from "cn";
import Link from "next/link";

import { ROW_LINK } from "@/components/common/row-link";
import SortableHead from "@/components/common/SortableHead";
import TableCard from "@/components/common/TableCard";
import StatusBadge from "@/components/StatusBadge";
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
import type { OrderColumn } from "@/lib/schemas/params";
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
 * **The order number is not one of the optional columns and must never become
 * one.** It carries that stretched link; hidden, the row would stop being
 * clickable at all. It is rendered outside the loop below for the same reason
 * `ORDER_COLUMNS` leaves it out.
 *
 * Order, Total and Placed sort by being links too (`SortableHead`).
 */

type Column = {
  id: OrderColumn;
  label: string;
  align?: "right";
  /** the field this column sorts by, when it sorts at all */
  sort?: string;
  cellClassName?: string;
  cell: (order: AdminOrderListItem) => React.ReactNode;
};

/**
 * One descriptor per column, read by both the header row and the body. Two lists
 * - one of `<th>`s and one of `<td>`s - would drift the first time a column moved.
 */
const COLUMNS: readonly Column[] = [
  {
    id: "status",
    label: "Status",
    cell: (order) => <StatusBadge status={order.status} />,
  },
  {
    id: "customer",
    label: "Customer",
    cellClassName: "max-w-64",
    cell: (order) => (
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
    ),
  },
  {
    id: "units",
    label: "Units",
    align: "right",
    cellClassName: "text-muted-foreground text-right tabular-nums",
    cell: (order) => order.units,
  },
  {
    id: "total",
    label: "Total",
    align: "right",
    sort: "total",
    cellClassName: "text-right font-semibold tabular-nums",
    cell: (order) => usd(order.total),
  },
  {
    id: "placed",
    label: "Placed",
    align: "right",
    sort: "placed",
    cellClassName: "text-muted-foreground text-right text-xs",
    // a draft has not been placed; say which date this is
    cell: (order) => (order.placedAt ? on(order.placedAt) : `Created ${on(order.createdAt)}`),
  },
];

export default function OrdersTable({
  orders,
  sort,
  cols,
  linkParams,
}: {
  orders: AdminOrderListItem[];
  sort: OrderSort;
  /** the visible columns, parsed from `?cols=` */
  cols: readonly OrderColumn[];
  linkParams: Params;
}) {
  const head = { base: "/orders", params: linkParams, sort };
  const shown = COLUMNS.filter((column) => cols.includes(column.id));

  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead {...head} field="number" label="Order" />
            {shown.map((column) =>
              column.sort ? (
                <SortableHead
                  key={column.id}
                  {...head}
                  field={column.sort}
                  label={column.label}
                  align={column.align}
                />
              ) : (
                <TableHead
                  key={column.id}
                  className={column.align === "right" ? "text-right" : undefined}
                >
                  {column.label}
                </TableHead>
              ),
            )}
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
                  className={cn(ROW_LINK, "font-mono font-semibold")}
                >
                  {order.number}
                </Link>
              </TableCell>
              {shown.map((column) => (
                <TableCell key={column.id} className={column.cellClassName}>
                  {column.cell(order)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
