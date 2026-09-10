"use client";

import { QUOTE_STATUSES, type QuoteStatusCode } from "@inkhaus/shared/orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import StatusBadge from "@/components/StatusBadge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { humanize } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/**
 * No Save button and no react-hook-form: one field, no validation beyond the
 * enum, and a triage queue where select-then-confirm is two actions for one
 * decision. The badge moves the moment you choose, and a toast reports the
 * outcome.
 *
 * The badge lives inside this component rather than in the card header so the
 * optimistic value has exactly one owner.
 *
 * No role check either - unlike an order status, there is no owner-only quote
 * transition, and the route handler mirrors that.
 */
export default function QuoteStatusControl({
  id,
  status,
}: {
  id: string;
  status: QuoteStatusCode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (next: QuoteStatusCode) => clientApi.quotes.setStatus(id, { status: next }),
    onError: (error) => {
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not update the quote", { description: error.message });
    },
    onSuccess: (quote) => {
      toast.success(`Marked ${humanize(quote.status).toLowerCase()}`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      // this page is server rendered, so the list itself refreshes here
      router.refresh();
    },
  });

  // While in flight, show where it is going; on failure `data` stays undefined
  // and it falls back to the server's value on its own.
  const shown = mutation.isPending ? mutation.variables : (mutation.data?.status ?? status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={shown} />

      <Label htmlFor={`quote-status-${id}`} className="text-muted-foreground text-xs">
        Move to
      </Label>
      <Select
        value={shown}
        disabled={mutation.isPending}
        onValueChange={(next) => mutation.mutate(next as QuoteStatusCode)}
      >
        <SelectTrigger
          id={`quote-status-${id}`}
          size="sm"
          className="w-40"
          data-testid="quote-select"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUOTE_STATUSES.map((code) => (
            <SelectItem key={code} value={code} data-testid="quote-option" data-status={code}>
              {humanize(code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mutation.isPending ? (
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
      ) : null}
    </div>
  );
}
