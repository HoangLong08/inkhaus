"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { can } from "@inkhaus/shared/admin";
import { CARRIER_LABEL, CARRIERS, trackingUrl, type OrderStatusCode } from "@inkhaus/shared/orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientApi } from "@/lib/client-api";
import { at } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { AdminOrderDetailTracking, AdminUser } from "@/lib/schemas/api";
import {
  ORDER_TRACKING_STATUSES,
  orderTrackingInputSchema,
  type OrderTrackingInput,
} from "@/lib/schemas/forms";

import { carrierLabel, knownCarrier } from "./format";
import {
  isSessionExpired,
  optimisticEvent,
  patchOrderDetail,
  restoreOrderDetail,
  useOrderDetail,
} from "./order-detail-query";

function noTrackingCopy(status: OrderStatusCode) {
  switch (status) {
    case "DRAFT":
    case "PENDING_PAYMENT":
    case "PAID":
      return "Tracking can be added once the order is in production.";
    case "IN_PRODUCTION":
      return "No tracking yet.";
    default:
      return "No tracking on this order.";
  }
}

/**
 * Carrier, number and the carrier's own tracking page - plus a form to add or
 * correct them without moving the order, for whoever holds `orders.tracking`
 * while the order is somewhere tracking makes sense. A client leaf because a
 * status move that ships the order fills it in, and so does this form.
 */
export default function TrackingCard({ number, viewer }: { number: string; viewer: AdminUser }) {
  const queryClient = useQueryClient();
  const { data: order } = useOrderDetail(number);

  // Here rather than in the form below: the form is re-keyed when the server
  // confirms a change, and a mutation living inside it would take its pending
  // state with it.
  const mutation = useMutation({
    mutationFn: (input: OrderTrackingInput) => clientApi.order.setTracking(number, input),

    onMutate: (input) =>
      patchOrderDetail(queryClient, number, (current) => {
        const tracking = {
          carrier: input.carrier,
          number: input.number,
          url: trackingUrl(input.carrier, input.number),
        };
        return {
          ...current,
          tracking,
          timeline: [
            ...current.timeline,
            optimisticEvent(
              "TRACKING",
              current.status,
              `${CARRIER_LABEL[input.carrier]} ${input.number}`,
              viewer,
              tracking,
            ),
          ],
        };
      }),

    onError: (error, _input, context) => {
      restoreOrderDetail(queryClient, number, context?.previous);
      if (isSessionExpired(error)) return;
      toast.error("Could not save the tracking", { description: error.message });
    },

    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.orders.detail(number), updated);
      toast.success("Tracking saved");
    },

    // the order list shows carrier and number too
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
    },
  });

  // warm from the page's HydrationBoundary; the guard is for the type
  if (!order) return null;

  const tracking = order.tracking;
  const editable =
    can(viewer.role, "orders.tracking") && ORDER_TRACKING_STATUSES.includes(order.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Shipping
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tracking ? (
          <TrackingDetails tracking={tracking} />
        ) : (
          <p className="text-muted-foreground text-sm">{noTrackingCopy(order.status)}</p>
        )}

        {order.shippedAt || order.deliveredAt ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {order.shippedAt ? (
              <>
                <dt className="text-muted-foreground">Shipped</dt>
                <dd>
                  <time dateTime={order.shippedAt} suppressHydrationWarning>
                    {at(order.shippedAt)}
                  </time>
                </dd>
              </>
            ) : null}
            {order.deliveredAt ? (
              <>
                <dt className="text-muted-foreground">Delivered</dt>
                <dd>
                  <time dateTime={order.deliveredAt} suppressHydrationWarning>
                    {at(order.deliveredAt)}
                  </time>
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {editable ? (
          // Keyed on the server's updatedAt, not on the tracking itself: a
          // confirmed change - from here or from a status move that shipped the
          // order - resets the fields to what is now saved, while a failed save
          // (which rolls the cache back) keeps what the operator typed.
          <TrackingForm
            key={order.updatedAt}
            current={tracking}
            pending={mutation.isPending}
            onSave={(input) => mutation.mutate(input)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function TrackingDetails({ tracking }: { tracking: AdminOrderDetailTracking }) {
  const carrier = carrierLabel(tracking.carrier);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Carrier</dt>
      <dd>{carrier}</dd>
      <dt className="text-muted-foreground">Tracking</dt>
      <dd className="min-w-0">
        {tracking.url ? (
          <Button asChild variant="link" size="sm" className="h-auto max-w-full p-0 font-mono">
            <a href={tracking.url} target="_blank" rel="noopener noreferrer" data-testid="tracking-link">
              <span className="truncate">{tracking.number}</span>
              <ExternalLink aria-hidden />
              <span className="sr-only">(opens {carrier} tracking)</span>
            </a>
          </Button>
        ) : (
          <span className="font-mono break-all">{tracking.number}</span>
        )}
      </dd>
    </dl>
  );
}

function TrackingForm({
  current,
  pending,
  onSave,
}: {
  current: AdminOrderDetailTracking | null;
  pending: boolean;
  onSave: (input: OrderTrackingInput) => void;
}) {
  const form = useForm<OrderTrackingInput>({
    resolver: zodResolver(orderTrackingInputSchema),
    defaultValues: { carrier: knownCarrier(current?.carrier), number: current?.number ?? "" },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-3 border-t pt-4"
        onSubmit={form.handleSubmit(onSave)}
        aria-label={current ? "Correct the tracking" : "Add tracking"}
        noValidate
      >
        <FormField
          control={form.control}
          name="carrier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carrier</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger className="w-full" data-testid="tracking-carrier">
                    <SelectValue placeholder="Choose a carrier" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CARRIERS.map((carrier) => (
                    <SelectItem
                      key={carrier}
                      value={carrier}
                      data-testid="tracking-carrier-option"
                      data-carrier={carrier}
                    >
                      {CARRIER_LABEL[carrier]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tracking number</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  data-testid="tracking-number"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={pending}
          data-testid="tracking-save"
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {current ? "Update tracking" : "Add tracking"}
        </Button>
      </form>
    </Form>
  );
}
