"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AdminQuoteDetail } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import type { QuoteUpdateInput } from "@/lib/schemas/forms";

type Options = {
  id: string;
  /** how the quote looks the moment the change is made, before the server answers */
  optimistic: (input: QuoteUpdateInput, quote: AdminQuoteDetail) => Partial<AdminQuoteDetail>;
  /** the success toast, from what the server says the quote now is */
  success: (quote: AdminQuoteDetail) => string;
  /** the error toast's title; the server's own sentence goes under it */
  failure: string;
  /** re-render the server page too - for a control on the server-rendered list */
  refresh?: boolean;
};

/**
 * The PATCH behind every triage control - status, assignee, follow-up - with
 * the lifecycle AGENTS.md asks of every write, written once so the three
 * cannot drift apart:
 *
 * - onMutate: the change shows at once in the shared detail entry, if this
 *   page has one;
 * - onError: that entry goes back to what it was, and a toast says why -
 *   except on a 401, which has already sent the page to sign-in;
 * - onSuccess: the server's detail replaces the guess, timeline included;
 * - onSettled: every quote query is invalidated, so the list behind this
 *   page is not left showing the old value.
 */
export function useQuoteUpdate({ id, optimistic, success, failure, refresh = false }: Options) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.quotes.detail(id);

  return useMutation({
    mutationFn: (input: QuoteUpdateInput) => clientApi.quotes.update(id, input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AdminQuoteDetail>(key);
      if (previous) {
        queryClient.setQueryData<AdminQuoteDetail>(key, {
          ...previous,
          ...optimistic(input, previous),
        });
      }
      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error(failure, { description: error.message });
    },

    onSuccess: (quote) => {
      queryClient.setQueryData(key, quote);
      toast.success(success(quote));
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      if (refresh) router.refresh();
    },
  });
}
