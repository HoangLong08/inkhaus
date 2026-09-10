"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  canSetStatus,
  ORDER_TRANSITIONS,
  type AdminRoleCode,
  type OrderStatusCode,
} from "@inkhaus/shared/orders";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { humanize } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { orderStatusInputSchema, type OrderStatusInput } from "@/lib/schemas/forms";

export default function OrderStatusForm({
  number,
  role,
}: {
  number: string;
  role: AdminRoleCode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Read the status from the cache rather than a prop, so the moves offered
  // change with the optimistic write this same form makes. Warm from the page's
  // HydrationBoundary; the fallback is for the type, not a state that occurs.
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(number),
    queryFn: () => clientApi.order(number),
  });
  const currentStatus: OrderStatusCode = order?.status ?? "DRAFT";

  // Two filters, and both matter: the transition table says what is reachable
  // from here, the role says what this person may reach. Staff simply never see
  // Cancel or Refund - offering a button that always 403s is worse than none.
  const reachable = useMemo(() => ORDER_TRANSITIONS[currentStatus] ?? [], [currentStatus]);
  const allowed = useMemo(
    () => reachable.filter((status) => canSetStatus(role, status)),
    [reachable, role],
  );

  const form = useForm<OrderStatusInput>({
    resolver: zodResolver(orderStatusInputSchema),
    defaultValues: { note: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: OrderStatusInput) => clientApi.setOrderStatus(number, input),

    // Optimistic, because the operator is looking at three parts of this page
    // that all depend on the answer - the badge, the timeline, and this very
    // list of moves - and a round trip of dead UI reads as a hung app.
    onMutate: async (input) => {
      const key = queryKeys.orders.detail(number);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Order>(key);

      queryClient.setQueryData<Order>(key, (order) =>
        order
          ? {
              ...order,
              status: input.status,
              timeline: [
                ...order.timeline,
                { status: input.status, note: input.note || null, at: new Date().toISOString() },
              ],
            }
          : order,
      );

      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.orders.detail(number), context.previous);
      }
      // 401 already redirected inside clientApi; saying anything here would
      // flash a toast at a page that is on its way out.
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not update the order", { description: error.message });
    },

    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(number), order);
      toast.success(`Moved to ${humanize(order.status)}`);
      form.reset({ status: undefined, note: "" });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(number) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      // The rest of this page - items, totals, address - is server rendered, and
      // so are the overview tiles this move just changed.
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Advance status
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
            <form
              className="space-y-3"
              onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
            >
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

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Note <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      {/* A textarea, not an input: a note is a tracking number
                          OR a refund reason, and the second one does not fit on
                          one line. The 500 limit is enforced here, by zod, and
                          again in the route handler. */}
                      <Textarea
                        rows={3}
                        maxLength={500}
                        placeholder="Tracking number, reason…"
                        data-testid="status-note"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription className="tabular-nums">
                      {field.value?.length ?? 0}/500
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
    </Card>
  );
}
