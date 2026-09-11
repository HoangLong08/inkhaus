"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QUOTE_NOTE_MAX } from "@inkhaus/shared/orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { AdminQuoteDetail } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import { quoteNoteInputSchema, type QuoteNoteInput } from "@/lib/schemas/forms";

type Me = { id: string; name: string | null; email: string };

/** marks an entry the server has not confirmed yet - the timeline dims it */
export const PENDING_EVENT_PREFIX = "pending-";

/**
 * A staff note on the quote's history. Internal: quotes have no customer-facing
 * page, and the customer's own message is never touched by this.
 */
export default function QuoteNotesForm({ id, me }: { id: string; me: Me }) {
  const queryClient = useQueryClient();
  const key = queryKeys.quotes.detail(id);

  const form = useForm<QuoteNoteInput>({
    resolver: zodResolver(quoteNoteInputSchema),
    defaultValues: { note: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: QuoteNoteInput) => clientApi.quotes.addNote(id, input),

    // The note appears on the timeline at once, under your name, dimmed until
    // the server confirms it.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AdminQuoteDetail>(key);
      if (previous) {
        queryClient.setQueryData<AdminQuoteDetail>(key, {
          ...previous,
          noteCount: previous.noteCount + 1,
          events: [
            ...previous.events,
            {
              id: `${PENDING_EVENT_PREFIX}${Date.now()}`,
              kind: "NOTE",
              status: null,
              note: input.note,
              at: new Date().toISOString(),
              actor: me,
            },
          ],
        });
      }
      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not save the note", { description: error.message });
    },

    onSuccess: (quote) => {
      queryClient.setQueryData(key, quote);
      toast.success("Note added");
      form.reset({ note: "" });
    },

    onSettled: () => {
      // the list's note count comes from the same writes
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() });
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-3" onSubmit={form.handleSubmit((input) => mutation.mutate(input))}>
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Add a note</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  maxLength={QUOTE_NOTE_MAX}
                  placeholder="Called back, sending samples Friday…"
                  data-testid="quote-note-input"
                  {...field}
                />
              </FormControl>
              <FormDescription className="flex justify-between gap-2">
                <span>Staff only - the customer never sees these.</span>
                <span className="tabular-nums">
                  {field.value.length}/{QUOTE_NOTE_MAX}
                </span>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={mutation.isPending} data-testid="quote-note-save">
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          Save note
        </Button>
      </form>
    </Form>
  );
}
