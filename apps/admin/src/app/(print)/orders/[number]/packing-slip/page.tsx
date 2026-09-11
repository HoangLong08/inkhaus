import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { methodLabel } from "@/components/order-detail/format";
import PrintButton from "@/components/order-detail/PrintButton";
import ShippingAddress from "@/components/order-detail/ShippingAddress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi, ApiError } from "@/lib/api";
import { count, on } from "@/lib/format";
import { orderNumberParamSchema } from "@/lib/schemas/forms";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params) {
  const { number } = await params;
  return { title: `Packing slip ${number} — INKHAUS Back Office` };
}

/** muted on screen, and still legible once printed */
const MUTED = "text-muted-foreground print:text-ink-3";
const SECTION_TITLE = `${MUTED} text-xs font-semibold uppercase tracking-wide`;

/**
 * What goes in the box: who it is for, where it goes, and every line broken
 * down by size - with no prices anywhere. The slip is read by whoever opens the
 * parcel, and for a team order that is rarely the person who paid.
 *
 * A plain server render with no client cache: nothing on it changes while it
 * is open, and the only control is window.print().
 */
export default async function PackingSlipPage({ params }: Params) {
  const parsed = orderNumberParamSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const order = await adminApi.order.get(parsed.data.number).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  const { customer } = order;
  const units = order.items.reduce((n, item) => n + item.quantity, 0);

  return (
    <article
      data-testid="packing-slip"
      className="mx-auto max-w-3xl space-y-8 px-6 py-8 print:max-w-none print:p-0"
    >
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={`/orders/${encodeURIComponent(order.number)}`} data-testid="packing-slip-back">
            <ArrowLeft />
            Back to {order.number}
          </Link>
        </Button>
        <PrintButton />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className={`${MUTED} text-xs font-semibold uppercase tracking-widest`}>INKHAUS</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Packing slip <span className="font-mono">{order.number}</span>
          </h1>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
          <dt className={MUTED}>Placed</dt>
          <dd>{order.placedAt ? on(order.placedAt) : "Not placed yet"}</dd>
          <dt className={MUTED}>Units</dt>
          <dd className="tabular-nums">{count(units)}</dd>
        </dl>
      </header>

      <Separator />

      <div className="grid gap-8 sm:grid-cols-2 print:grid-cols-2">
        <section aria-labelledby="slip-ship-to" className="space-y-2">
          <h2 id="slip-ship-to" className={SECTION_TITLE}>
            Ship to
          </h2>
          <ShippingAddress address={order.shippingAddress} />
        </section>

        <section aria-labelledby="slip-customer" className="space-y-2">
          <h2 id="slip-customer" className={SECTION_TITLE}>
            Customer
          </h2>
          <div className="text-sm leading-relaxed">
            <p>{customer.name ?? customer.email}</p>
            {customer.company ? <p>{customer.company}</p> : null}
            {customer.name ? <p className="break-all">{customer.email}</p> : null}
            {customer.phone ? <p>{customer.phone}</p> : null}
          </div>
        </section>
      </div>

      <section aria-labelledby="slip-items" className="space-y-2">
        <h2 id="slip-items" className={SECTION_TITLE}>
          Items
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item, i) =>
              item.sizes.map((size, j) => (
                <TableRow key={`${i}-${size.size}`} data-size={size.size}>
                  {/* the item once, beside all of its sizes */}
                  {j === 0 ? (
                    <TableCell rowSpan={item.sizes.length} className="whitespace-normal align-top">
                      <p className="font-medium">{item.productName}</p>
                      <p className={`${MUTED} text-xs`}>
                        {item.color.name} · {methodLabel(item.method)}
                      </p>
                      <p className={`${MUTED} text-xs`}>
                        {item.design
                          ? `Artwork: ${item.design.name} (${item.design.publicId})`
                          : "Blank, no artwork"}
                      </p>
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">{size.size}</TableCell>
                  <TableCell className="text-right tabular-nums">{size.qty}</TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total units</TableCell>
              <TableCell className="text-right tabular-nums">{count(units)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>

      {order.notes ? (
        <section aria-labelledby="slip-note" className="space-y-2">
          <h2 id="slip-note" className={SECTION_TITLE}>
            Note from the customer
          </h2>
          <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
        </section>
      ) : null}
    </article>
  );
}
