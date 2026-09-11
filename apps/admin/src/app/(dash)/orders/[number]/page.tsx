import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import CustomerCard from "@/components/order-detail/CustomerCard";
import OrderItemsCard from "@/components/order-detail/OrderItemsCard";
import OrderNotesForm from "@/components/order-detail/OrderNotesForm";
import ShippingAddress from "@/components/order-detail/ShippingAddress";
import TrackingCard from "@/components/order-detail/TrackingCard";
import OrderStatusForm from "@/components/orders/OrderStatusForm";
import OrderStatusLive from "@/components/orders/OrderStatusLive";
import OrderTimeline from "@/components/orders/OrderTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { at } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { orderNumberParamSchema } from "@/lib/schemas/forms";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params) {
  const { number } = await params;
  return { title: `${number} — INKHAUS Back Office` };
}

/**
 * The screen operators live in. One server fetch, dehydrated into the client
 * cache, and a handful of small client leaves reading that same entry - the
 * badge, the timeline, the status form, the tracking card and the note form -
 * because a single write changes regions in both columns at once.
 *
 * Everything else - line items, per-size pricing, the artwork, the customer,
 * the address - cannot change from this screen and stays server rendered,
 * which keeps the client bundle down to those leaves.
 */
export default async function OrderPage({ params }: Params) {
  const [raw, user] = await Promise.all([
    params,
    // cached by the DAL, so this costs nothing beyond the layout's own call
    requireAdmin(),
  ]);

  // a segment no order number could be never reaches the API
  const parsed = orderNumberParamSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const { number } = parsed.data;

  const queryClient = getQueryClient();

  // fetchQuery, not prefetchQuery: the server render needs the value too, for
  // the parts of this page that are not client components.
  const order = await queryClient
    .fetchQuery({
      queryKey: queryKeys.orders.detail(number),
      queryFn: () => adminApi.order.get(number),
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    });

  const placed = order.placedAt
    ? `placed ${at(order.placedAt)}`
    : `draft, created ${at(order.createdAt)}`;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href="/orders" data-testid="order-back">
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
              {order.customer.email} · {placed}
            </p>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link
              href={`/orders/${encodeURIComponent(order.number)}/packing-slip`}
              data-testid="packing-slip-link"
            >
              <Printer />
              Packing slip
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <OrderItemsCard order={order} />
            <OrderTimeline number={order.number} />
            {can(user.role, "orders.note") ? (
              <OrderNotesForm number={order.number} viewer={user} />
            ) : null}
          </div>

          <div className="space-y-6">
            {can(user.role, "orders.advance") ? (
              <OrderStatusForm number={order.number} viewer={user} />
            ) : null}
            <TrackingCard number={order.number} viewer={user} />
            <CustomerCard order={order} role={user.role} />

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Ship to
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ShippingAddress address={order.shippingAddress} className="text-muted-foreground" />
              </CardContent>
            </Card>

            {order.notes ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Note from the customer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm">{order.notes}</p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
