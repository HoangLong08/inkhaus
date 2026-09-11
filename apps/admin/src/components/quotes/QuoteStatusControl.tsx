"use client";

import { canSetQuoteStatus, QUOTE_STATUSES, type QuoteStatusCode } from "@inkhaus/shared/orders";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import StatusBadge from "@/components/StatusBadge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humanize } from "@/lib/format";
import { quoteStatusSchema } from "@/lib/schemas/api";

import { useQuoteDetail } from "./useQuoteDetail";
import { useQuoteUpdate } from "./useQuoteUpdate";

/**
 * No Save button and no react-hook-form: one field, no validation beyond the
 * enum, and a triage queue where select-then-confirm is two actions for one
 * decision. The badge moves the moment you choose, and a toast reports the
 * outcome.
 *
 * The badge lives inside this component so the optimistic value has exactly one
 * owner. On the list, which is server rendered and has no cache entry, that is
 * the mutation's own variables; on the quote page it is the shared detail
 * entry, via `QuoteStatusLive` below.
 *
 * No role check: there is no owner-only quote status. The one value-level rule
 * is that a converted quote stays WON, so it is offered nothing else - and the
 * route handler and the API refuse anything else too.
 */
export default function QuoteStatusControl({
  id,
  status,
  convertedOrderNumber,
  label,
}: {
  id: string;
  status: QuoteStatusCode;
  /** set once the quote has become an order */
  convertedOrderNumber: string | null;
  /** read by screen readers; the list's column header is the visible label */
  label: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const mutation = useQuoteUpdate({
    id,
    optimistic: (input) => (input.status ? { status: input.status } : {}),
    success: (quote) => `Marked ${humanize(quote.status).toLowerCase()}`,
    failure: "Could not update the quote",
  });

  // The live value, except while a change is in the air. `status` is the cache
  // entry on the quote page - which a rollback, a convert's optimistic WON or a
  // colleague's change on refetch all move - and the server-rendered row on
  // the list. The list only learns a new status from a refresh, so the saved
  // one is held for exactly as long as that refresh takes, and no longer.
  const shown = mutation.isPending
    ? (mutation.variables.status ?? status)
    : refreshing && mutation.isSuccess
      ? mutation.data.status
      : status;

  function choose(next: string) {
    const parsed = quoteStatusSchema.safeParse(next);
    if (!parsed.success) return;
    mutation.mutate(
      { status: parsed.data },
      // the list is server rendered, so it only shows the new status on a refresh
      { onSettled: () => startRefresh(() => router.refresh()) },
    );
  }

  // the order's number stands in for its id - either is set exactly when the
  // quote is an order, which is all the shared rule looks at
  const offered = QUOTE_STATUSES.filter((code) =>
    canSetQuoteStatus({ convertedOrderId: convertedOrderNumber }, code),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={shown} />

      <Label htmlFor={`quote-status-${id}`} className="sr-only">
        {label}
      </Label>
      <Select
        value={shown}
        disabled={mutation.isPending || offered.length < 2}
        onValueChange={choose}
      >
        <SelectTrigger
          id={`quote-status-${id}`}
          size="sm"
          className="w-36"
          data-testid="quote-select"
          data-status={shown}
          title={
            convertedOrderNumber
              ? `This quote became order ${convertedOrderNumber}, so it stays won.`
              : undefined
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {offered.map((code) => (
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

/** the quote page's control, reading the status the page's other leaves share */
export function QuoteStatusLive({ id, label }: { id: string; label: string }) {
  const { data: quote } = useQuoteDetail(id);

  // warm from the page's HydrationBoundary; the guard is for the type
  if (!quote) return null;

  return (
    <QuoteStatusControl
      id={id}
      status={quote.status}
      convertedOrderNumber={quote.convertedOrderNumber}
      label={label}
    />
  );
}
