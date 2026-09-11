import Link from "next/link";

import SortableHead from "@/components/common/SortableHead";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerListItem } from "@/lib/api";
import { count, on, relative, usd } from "@/lib/format";
import type { CustomersQuery } from "@/lib/schemas/params";

const BASE = "/customers";

/**
 * The customer list. Server rendered like every list: the rows are a pure
 * projection of the URL.
 *
 * The whole row opens the profile. A `<tr>` cannot be a link, so the email is
 * the one real link and its `::after` is stretched over the row - one tab stop,
 * a real href to open in a new tab, and no client component just to call
 * `router.push` from a click handler.
 */
export default function CustomersTable({
  customers,
  params,
}: {
  customers: CustomerListItem[];
  params: CustomersQuery;
}) {
  const sort = params.sort ?? "created_desc";
  const head = { base: BASE, params, sort };

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <SortableHead {...head} field="name" label="Name" first="asc" />
            <SortableHead {...head} field="orders" label="Orders" align="right" />
            <TableHead className="text-right">Lifetime value</TableHead>
            <TableHead className="text-right">Last order</TableHead>
            <SortableHead {...head} field="login" label="Last sign-in" align="right" />
            <SortableHead {...head} field="created" label="Created" align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow
              key={customer.id}
              data-testid="customer-row"
              data-id={customer.id}
              data-email={customer.email}
              className="relative"
            >
              <TableCell className="max-w-72">
                <div className="flex items-center gap-2">
                  <Link
                    href={`${BASE}/${customer.id}`}
                    data-testid="customer-row-link"
                    className="focus-visible:after:ring-ring truncate font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-inset"
                  >
                    {customer.email}
                  </Link>
                  {customer.googleLinked ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Google
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-56">
                <div className="truncate">{customer.name ?? "—"}</div>
                {customer.company ? (
                  <div className="text-muted-foreground truncate text-xs">{customer.company}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{count(customer.orderCount)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {usd(customer.lifetimeValue)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-xs">
                {customer.lastOrderAt ? relative(customer.lastOrderAt) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-xs">
                {customer.lastLoginAt ? relative(customer.lastLoginAt) : "Never"}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-xs">
                {on(customer.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
