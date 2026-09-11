"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CARRIER_LABEL,
  CARRIERS,
  canSetStatus,
  ORDER_NOTE_MAX,
  ORDER_TRANSITIONS,
  requiresTracking,
  trackingUrl,
  type OrderStatusCode,
} from "@inkhaus/shared/orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type DefaultValues } from "react-hook-form";
import { toast } from "sonner";

import { carrierLabel } from "@/components/order-detail/format";
import {
  isSessionExpired,
  optimisticEvent,
  patchOrderDetail,
  restoreOrderDetail,
  useOrderDetail,
} from "@/components/order-detail/order-detail-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/lib/client-api";
import { humanize } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { AdminUser } from "@/lib/schemas/api";
import {
  orderStatusFormSchema,
  orderStatusInputFromForm,
  type OrderStatusFormValues,
  type OrderStatusInput,
} from "@/lib/schemas/forms";

const BLANK: DefaultValues<OrderStatusFormValues> = { note: "", trackingNumber: "" };

/**
 * A move with no way back: the transition table lists nothing after it. Today
 * that is CANCELLED and REFUNDED, and it is read off the table rather than
 * listed, so a status added later is asked about the day it becomes final.
 */
const isFinal = (status: OrderStatusCode) => ORDER_TRANSITIONS[status].length === 0;

function confirmCopy(status: OrderStatusCode, number: string) {
  switch (status) {
    case "CANCELLED":
      return {
        title: `Cancel ${number}?`,
        body: "Cancelling is final — the order cannot be moved again afterwards.",
        action: "Cancel order",
      };
    case "REFUNDED":
      return {
        title: `Mark ${number} refunded?`,
        body: "This is final, and it only records the refund — it does not send any money back.",
        action: "Mark refunded",
      };
    default:
      return {
        title: `Move ${number} to ${humanize(status)}?`,
        body: `${humanize(status)} is final — the order cannot be moved again afterwards.`,
        action: `Move to ${humanize(status)}`,
      };
  }
}

export default function OrderStatusForm({ number, viewer }: { number: string; viewer: AdminUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Read the status from the cache rather than a prop, so the moves offered
  // change with the optimistic write this same form makes. Warm from the page's
  // HydrationBoundary; the fallback is for the type, not a state that occurs.
  const { data: order } = useOrderDetail(number);
  const currentStatus: OrderStatusCode = order?.status ?? "DRAFT";
  const currentTracking = order?.tracking ?? null;
  const hasTracking = currentTracking !== null;

  // Two filters, and both matter: the transition table says what is reachable
  // from here, the role says what this person may reach. Staff simply never see
  // Cancel or Refund - offering a choice that always 403s is worse than none.
  const reachable = ORDER_TRANSITIONS[currentStatus];
  const allowed = reachable.filter((status) => canSetStatus(viewer.role, status));

  // Rebuilt each render: whether SHIPPED needs tracking typed in here depends on
  // whether the order already has some, and that can change under the form.
  const form = useForm<OrderStatusFormValues>({
    resolver: zodResolver(orderStatusFormSchema({ hasTracking })),
    defaultValues: BLANK,
  });
  const target = useWatch({ control: form.control, name: "status" });
  const shipping = Boolean(target) && requiresTracking(target);
  const needsTracking = shipping && !hasTracking;

  /** a final move waiting on the confirmation dialog */
  const [confirming, setConfirming] = useState<OrderStatusInput | null>(null);

  const mutation = useMutation({
    mutationFn: (input: OrderStatusInput) => clientApi.order.setStatus(number, input),

    // Optimistic, because the operator is looking at every region of this page
    // the answer changes - the badge, the timeline, the tracking card and this
    // very list of moves - and a round trip of dead UI reads as a hung app.
    // Exactly one STATUS event, plus a TRACKING one when tracking went with it:
    // the same events the API is about to write.
    onMutate: (input) =>
      patchOrderDetail(queryClient, number, (current) => {
        const events = [optimisticEvent("STATUS", input.status, input.note ?? null, viewer)];
        let tracking = current.tracking;
        if (input.tracking) {
          const { carrier, number: parcel } = input.tracking;
          tracking = { carrier, number: parcel, url: trackingUrl(carrier, parcel) };
          events.push(
            optimisticEvent("TRACKING", input.status, `${CARRIER_LABEL[carrier]} ${parcel}`, viewer, tracking),
          );
        }
        return {
          ...current,
          status: input.status,
          tracking,
          timeline: [...current.timeline, ...events],
        };
      }),

    onError: (error, _input, context) => {
      restoreOrderDetail(queryClient, number, context?.previous);
      if (isSessionExpired(error)) return;
      toast.error("Could not update the order", { description: error.message });
    },

    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.orders.detail(number), updated);
      toast.success(`Moved to ${humanize(updated.status)}`);
      form.reset(BLANK);
    },

    onSettled: () => {
      // the prefix reaches this order's entry and every list it sits in
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      // The header's "placed" line is server rendered - leaving DRAFT sets it -
      // and so are the overview tiles this move just changed.
      router.refresh();
    },
  });

  const submit = form.handleSubmit((values) => {
    const input = orderStatusInputFromForm(values, { hasTracking });
    if (isFinal(input.status)) setConfirming(input);
    else mutation.mutate(input);
  });

  const copy = confirming ? confirmCopy(confirming.status, number) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allowed.length === 0 ? (
          // An empty list has two very different causes, and telling staff an
          // order is "final" when it is really "not yours to cancel" would send
          // them hunting for a bug.
          <p className="text-muted-foreground text-sm" data-testid="no-moves">
            {reachable.length === 0
              ? `${humanize(currentStatus)} is a final state — nothing left to do here.`
              : `Moving an order out of ${humanize(currentStatus)} is limited to owners.`}
          </p>
        ) : (
          <Form {...form}>
            <form className="space-y-4" onSubmit={submit} noValidate>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Move to</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full" data-testid="status-select">
                          <SelectValue placeholder="Choose a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allowed.map((status) => (
                          <SelectItem
                            key={status}
                            value={status}
                            data-testid="status-option"
                            data-status={status}
                          >
                            {humanize(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {needsTracking ? (
                <fieldset className="space-y-3">
                  <legend className="text-muted-foreground mb-2 text-sm">
                    A shipped order needs its carrier and tracking number.
                  </legend>

                  <FormField
                    control={form.control}
                    name="carrier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger className="w-full" data-testid="status-tracking-carrier">
                              <SelectValue placeholder="Choose a carrier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CARRIERS.map((carrier) => (
                              <SelectItem
                                key={carrier}
                                value={carrier}
                                data-testid="status-tracking-carrier-option"
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
                    name="trackingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking number</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="off"
                            spellCheck={false}
                            className="font-mono"
                            data-testid="status-tracking-number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>
              ) : null}

              {shipping && currentTracking ? (
                <p className="text-muted-foreground text-sm">
                  Ships with {carrierLabel(currentTracking.carrier)}{" "}
                  <span className="font-mono">{currentTracking.number}</span>.
                </p>
              ) : null}

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Note <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      {/* ORDER_NOTE_MAX is the shared limit - the same number
                          zod enforces here, the route handler enforces, and the
                          API validates with. */}
                      <Textarea
                        rows={3}
                        maxLength={ORDER_NOTE_MAX}
                        placeholder="A reason, or anything the customer should know"
                        data-testid="status-note"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription className="flex justify-between gap-2">
                      <span>Shown to the customer on their order page.</span>
                      <span className="tabular-nums">
                        {field.value?.length ?? 0}/{ORDER_NOTE_MAX}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
                data-testid="status-save"
              >
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </form>
          </Form>
        )}
      </CardContent>

      {/* Opened by Save, not by picking the option, so the reason can be
          written first. Radix focuses Cancel when it opens, which is the right
          default for a move that cannot be undone. */}
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent data-testid="status-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy?.body}
              {confirming?.note ? " Your note will be shown to the customer." : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="status-confirm-cancel">Go back</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="status-confirm"
              onClick={() => {
                if (confirming) mutation.mutate(confirming);
              }}
            >
              {copy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
