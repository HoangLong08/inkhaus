"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ORDER_INTERNAL_NOTE_MAX } from "@inkhaus/shared/orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import type { AdminUser } from "@/lib/schemas/api";
import { orderNoteInputSchema, type OrderNoteInput } from "@/lib/schemas/forms";

import {
  isSessionExpired,
  optimisticEvent,
  patchOrderDetail,
  restoreOrderDetail,
} from "./order-detail-query";

/**
 * Staff talking to staff about this order. The note lands on the timeline
 * with its author and an "Internal" badge, and never on the customer's order
 * page - the API's public mapper drops the kind outright. It writes the page's
 * shared cache entry but reads nothing from it: a note is filed under whatever
 * status the entry holds at the moment it is written.
 */
export default function OrderNotesForm({ number, viewer }: { number: string; viewer: AdminUser }) {
  const queryClient = useQueryClient();

  const form = useForm<OrderNoteInput>({
    resolver: zodResolver(orderNoteInputSchema),
    defaultValues: { note: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: OrderNoteInput) => clientApi.order.addNote(number, input),

    onMutate: (input) =>
      patchOrderDetail(queryClient, number, (current) => ({
        ...current,
        timeline: [...current.timeline, optimisticEvent("NOTE", current.status, input.note, viewer)],
      })),

    // the text stays in the box, so a failed note is one click from a retry
    onError: (error, _input, context) => {
      restoreOrderDetail(queryClient, number, context?.previous);
      if (isSessionExpired(error)) return;
      toast.error("Could not add the note", { description: error.message });
    },

    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.orders.detail(number), updated);
      toast.success("Note added");
      form.reset({ note: "" });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(number) });
    },
  });

  const submit = form.handleSubmit((input) => mutation.mutate(input));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Staff notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-3" onSubmit={submit} noValidate>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Add a note</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      maxLength={ORDER_INTERNAL_NOTE_MAX}
                      placeholder="Called the customer, reprint needed, …"
                      data-testid="order-note-input"
                      {...field}
                      onKeyDown={(event) => {
                        // a textarea keeps Enter for new lines; the modifier sends
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription className="flex justify-between gap-2">
                    <span>Only staff see this. Ctrl+Enter adds it.</span>
                    <span className="tabular-nums">
                      {field.value.length}/{ORDER_INTERNAL_NOTE_MAX}
                    </span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={mutation.isPending}
              data-testid="order-note-save"
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Add note
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
