"use client";

import { useQuery } from "@tanstack/react-query";

import CustomerEditDialog from "@/components/customers/CustomerEditDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { clientApi } from "@/lib/client-api";
import { at, on } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/**
 * Who the customer is and what staff know about them. A client leaf because the
 * edit dialog changes it in place: it reads the hydrated cache entry the dialog
 * writes optimistically, so a saved phone number shows before the round trip
 * ends.
 *
 * Every value carries `data-field`, so a test can find the phone without
 * knowing what the label beside it says.
 */
export default function CustomerProfileCard({ id, canEdit }: { id: string; canEdit: boolean }) {
  const { data: customer } = useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => clientApi.customers.get(id),
  });

  if (!customer) return null;

  return (
    <Card data-testid="customer-profile">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Profile
        </CardTitle>
        {canEdit ? (
          <CardAction>
            <CustomerEditDialog customer={customer} />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          <Field label="Email" field="email" value={customer.email} />
          <Field label="Phone" field="phone" value={customer.phone} />
          <Field label="Company" field="company" value={customer.company} />

          <dt className="text-muted-foreground">Sign-in</dt>
          <dd data-field="google" data-linked={customer.googleLinked ? "true" : "false"}>
            {customer.googleLinked ? (
              <Badge variant="outline">Google account</Badge>
            ) : (
              <span className="text-muted-foreground">Guest checkout only</span>
            )}
          </dd>

          {/* Dates are formatted in the viewer's time zone, which the server
              rendering this first may not share - hence the hydration opt-out on
              exactly these two text nodes. */}
          <dt className="text-muted-foreground">Customer since</dt>
          <dd>
            <time dateTime={customer.createdAt} suppressHydrationWarning>
              {on(customer.createdAt)}
            </time>
          </dd>

          <dt className="text-muted-foreground">Last sign-in</dt>
          <dd>
            {customer.lastLoginAt ? (
              <time dateTime={customer.lastLoginAt} suppressHydrationWarning>
                {at(customer.lastLoginAt)}
              </time>
            ) : (
              <span className="text-muted-foreground">Never</span>
            )}
          </dd>
        </dl>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Staff note
          </p>
          {customer.adminNote ? (
            <p data-field="note" className="whitespace-pre-wrap break-words">
              {customer.adminNote}
            </p>
          ) : (
            <p data-field="note" className="text-muted-foreground">
              No note yet.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Seen by staff only - never shown to the customer.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, field, value }: { label: string; field: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd data-field={field} className="break-words">
        {value ?? <span className="text-muted-foreground">Not given</span>}
      </dd>
    </>
  );
}
