import { can } from "@inkhaus/shared/admin";
import type { AdminRoleCode } from "@inkhaus/shared/orders";
import { FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminOrderDetail } from "@/lib/schemas/api";

/**
 * Who placed the order and how to reach them, with a way into their profile
 * and - for a converted bulk quote - back to the conversation it started as.
 * Each link is shown only to a role that can open what it points at.
 */
export default function CustomerCard({
  order,
  role,
}: {
  order: AdminOrderDetail;
  role: AdminRoleCode;
}) {
  const { customer, quote } = order;
  const label = customer.name ?? customer.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Customer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          {can(role, "customers.view") ? (
            <Button asChild variant="link" className="h-auto p-0 font-semibold">
              <Link href={`/customers/${encodeURIComponent(customer.id)}`} data-testid="customer-link">
                {label}
              </Link>
            </Button>
          ) : (
            <p className="font-semibold">{label}</p>
          )}
          {customer.company ? <p className="text-muted-foreground">{customer.company}</p> : null}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{customer.email}</dd>
          {customer.phone ? (
            <>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{customer.phone}</dd>
            </>
          ) : null}
        </dl>

        {quote && can(role, "quotes.manage") ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/quotes/${encodeURIComponent(quote.id)}`} data-testid="quote-origin-link">
              <FileText />
              Converted from a bulk quote
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
