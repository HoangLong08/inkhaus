import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import OrderStatusForm from "@/components/orders/OrderStatusForm";
import OrderStatusLive from "@/components/orders/OrderStatusLive";
import OrderTimeline from "@/components/orders/OrderTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { at, humanize, usd } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `${number} — INKHAUS Back Office` };
}

/**
 * The one page where a client cache earns its place: a single status write
 * changes three regions that sit in two different grid columns - the badge by
 * the heading, the timeline, and the set of moves still available.
 *
 * So: one server fetch, dehydrated into the client cache, and three small client
 * leaves reading that same entry. Everything else - line items, totals, the
 * shipping address - cannot change from this screen and stays server rendered,
 * which keeps the client bundle for this route down to those three leaves.
 */
export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const [{ number }, user] = await Promise.all([
    params,
    // cached by the DAL, so this costs nothing beyond the layout's own call
    requireAdmin(),
  ]);

  const queryClient = getQueryClient();

  // fetchQuery, not prefetchQuery: the server render needs the value too, for
  // the two thirds of this page that are not client components.
  const order = await queryClient
    .fetchQuery({
      queryKey: queryKeys.orders.detail(number),
      queryFn: () => adminApi.order(number),
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    });

  const ship = order.shippingAddress;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/orders">
              <ArrowLeft />
              Orders
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight">{order.number}</h1>
            <OrderStatusLive number={order.number} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.customer.name ? `${order.customer.name} · ` : ""}
            {order.customer.email} · placed {at(order.placedAt ?? order.createdAt)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="gap-0 overflow-hidden p-0">
              <CardHeader className="bg-muted/50 border-b px-4 py-2.5">
                <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Items
                </CardTitle>
              </CardHeader>

              <ul className="divide-y">
                {order.items.map((item, i) => (
                  <li key={i} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-semibold">{item.productName}</span>
                      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                        {/* the one legitimate inline colour in this app: it is
                            product data, not a design token */}
                        <span
                          aria-hidden
                          className="inline-block size-3 rounded-full border"
                          style={{ background: item.color.hex }}
                        />
                        {item.color.name}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {humanize(item.method)}
                      </span>
                      <span className="ml-auto text-sm font-semibold tabular-nums">
                        {usd(item.lineTotal)}
                      </span>
                    </div>

                    <p className="text-muted-foreground text-sm">
                      {item.sizes.map((s) => `${s.size}×${s.qty}`).join("  ")}
                      <span> · {item.quantity} units @ {usd(item.unitPrice)}</span>
                    </p>

                    {item.designId ? (
                      <p className="text-muted-foreground font-mono text-xs">
                        design {item.designId}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">blank, no artwork</p>
                    )}
                  </li>
                ))}
              </ul>

              <CardFooter className="bg-muted/50 flex-col items-stretch gap-1 border-t px-4 py-3 text-sm">
                <dl className="space-y-1">
                  <Row label="Subtotal" value={usd(order.subtotal)} />
                  {order.discount > 0 ? (
                    <Row label="Discount" value={`−${usd(order.discount)}`} />
                  ) : null}
                  <Row
                    label="Shipping"
                    value={order.shipping === 0 ? "Free" : usd(order.shipping)}
                  />
                  {order.tax > 0 ? <Row label="Tax" value={usd(order.tax)} /> : null}
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{usd(order.total)}</dd>
                  </div>
                </dl>
              </CardFooter>
            </Card>

            <OrderTimeline number={order.number} />
          </div>

          <div className="space-y-6">
            <OrderStatusForm number={order.number} role={user.role} />

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Ship to
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ship.line1 ? (
                  <address className="text-muted-foreground text-sm not-italic leading-relaxed">
                    {ship.name ? (
                      <>
                        {ship.name}
                        <br />
                      </>
                    ) : null}
                    {ship.line1}
                    <br />
                    {ship.line2 ? (
                      <>
                        {ship.line2}
                        <br />
                      </>
                    ) : null}
                    {[ship.city, ship.state, ship.postal].filter(Boolean).join(", ")}
                    <br />
                    {ship.country}
                  </address>
                ) : (
                  <p className="text-muted-foreground text-sm">No address on this order.</p>
                )}
              </CardContent>
            </Card>

            {order.notes ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Customer notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                    {order.notes}
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-muted-foreground flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
