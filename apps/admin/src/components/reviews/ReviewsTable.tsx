"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MoreHorizontal, RotateCcw, Trash2, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { OrdinalCell, OrdinalHead } from "@/components/common/Ordinal";
import { TOOLBAR_BUTTON } from "@/components/common/toolbar-styles";
import TableCard from "@/components/common/TableCard";
import RatingStars from "@/components/reviews/RatingStars";
import StatusBadge from "@/components/StatusBadge";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReviewListItem, ReviewStatus } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { at, count, humanize } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/** the three moves every row offers, in menu order */
const MOVES: { to: ReviewStatus; label: string; testId: string; icon: LucideIcon }[] = [
  { to: "PUBLISHED", label: "Publish", testId: "review-publish", icon: Check },
  { to: "REJECTED", label: "Reject", testId: "review-reject", icon: X },
  { to: "PENDING", label: "Back to pending", testId: "review-pending", icon: RotateCcw },
];

/** past tense for a toast: "Review published" */
const DONE: Record<ReviewStatus, string> = {
  PUBLISHED: "published",
  REJECTED: "rejected",
  PENDING: "sent back to pending",
};

/**
 * Where a row is shown while a write about it is in flight, or has landed but
 * the refreshed page has not arrived yet. `DELETED` hides the row.
 */
type Optimistic = { to: ReviewStatus | "DELETED"; settled: boolean };
type Overlay = Readonly<Record<string, Optimistic>>;

/** what a write needs to undo itself: the entries it replaced */
type Rollback = { ids: readonly string[]; before: Overlay };

function place(overlay: Overlay, ids: readonly string[], to: Optimistic["to"]): Overlay {
  const next = { ...overlay };
  for (const id of ids) next[id] = { to, settled: false };
  return next;
}

function restore(overlay: Overlay, { ids, before }: Rollback): Overlay {
  const next = { ...overlay };
  for (const id of ids) {
    if (before[id]) next[id] = before[id];
    else delete next[id];
  }
  return next;
}

function settle(overlay: Overlay, { ids }: Rollback): Overlay {
  const next = { ...overlay };
  for (const id of ids) if (next[id]) next[id] = { ...next[id], settled: true };
  return next;
}

/** once fresh rows arrive, a landed write is theirs to show */
function withoutSettled(overlay: Overlay): Overlay {
  return Object.fromEntries(Object.entries(overlay).filter(([, entry]) => !entry.settled));
}

function without(set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

/**
 * The moderation table. It renders exactly the rows the server page passed in
 * and owns only browser state: which rows are ticked, and where a row is shown
 * while a write about it is in flight.
 *
 * Every write flips its rows at once (onMutate), puts them back if the server
 * refuses (onError), and on the way out asks the router for a fresh copy of the
 * page (onSettled) - the server-rendered list, the meta line and the filters
 * all depend on what just changed. A landed write keeps its badge until that
 * copy arrives, so nothing flickers back to the old status in between.
 *
 * A row with a write in flight cannot be picked for another one, so two writes
 * about the same review never overlap and a rollback only ever undoes its own.
 */
export default function ReviewsTable({
  reviews,
  canModerate,
  canDelete,
  from,
}: {
  reviews: ReviewListItem[];
  canModerate: boolean;
  canDelete: boolean;
  /** the ordinal of this page's first row - `ordinalFrom(meta.page, meta.limit)` */
  from: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [overlay, setOverlay] = useState<Overlay>({});
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<ReviewListItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // A new page from the server. What it now shows supersedes every write that
  // has landed, and a ticked review that is no longer listed cannot stay ticked.
  // Adjusted during render rather than in an effect, so the stale version is
  // never painted.
  const [shownRows, setShownRows] = useState(reviews);
  if (shownRows !== reviews) {
    setShownRows(reviews);
    setOverlay(withoutSettled);
    const listed = new Set(reviews.map((review) => review.id));
    setSelected((current) => new Set([...current].filter((id) => listed.has(id))));
  }

  const busy = (id: string) => overlay[id] !== undefined && !overlay[id].settled;
  const statusOf = (review: ReviewListItem): ReviewStatus => {
    const entry = overlay[review.id];
    return entry && entry.to !== "DELETED" ? entry.to : review.status;
  };

  const rows = reviews.filter((review) => overlay[review.id]?.to !== "DELETED");
  const selectable = rows.filter((review) => !busy(review.id));
  const chosen = rows.filter((review) => selected.has(review.id));
  const allChosen = selectable.length > 0 && selectable.every((review) => selected.has(review.id));

  function begin(ids: readonly string[], to: Optimistic["to"]): Rollback {
    const rollback = { ids, before: Object.fromEntries(ids.flatMap((id) => (overlay[id] ? [[id, overlay[id]]] : []))) };
    setOverlay((current) => place(current, ids, to));
    return rollback;
  }

  function fail(error: Error, rollback: Rollback | undefined, title: string) {
    if (rollback) setOverlay((current) => restore(current, rollback));
    // a 401 has already sent the browser to /login
    if (error instanceof ClientApiError && error.status === 401) return;
    toast.error(title, { description: error.message });
  }

  function land(rollback: Rollback | undefined) {
    if (rollback) setOverlay((current) => settle(current, rollback));
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all() });
    // the list is server rendered, so the rows themselves come back this way
    router.refresh();
  }

  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      clientApi.reviews.moderate(id, { status }),
    onMutate: ({ id, status }) => begin([id], status),
    onError: (error, _input, rollback) => fail(error, rollback, "Could not update the review"),
    onSuccess: (review, _input, rollback) => {
      land(rollback);
      toast.success(`Review ${DONE[review.status]}`);
    },
    onSettled: () => refresh(),
  });

  const bulk = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: ReviewStatus }) =>
      clientApi.reviews.bulk({ ids, status }),
    onMutate: ({ ids, status }) => begin(ids, status),
    onError: (error, _input, rollback) => fail(error, rollback, "Could not update those reviews"),
    onSuccess: ({ updated }, { ids, status }, rollback) => {
      land(rollback);
      setSelected((current) => without(current, ids));
      const skipped = ids.length - updated;
      toast.success(`${count(updated)} ${updated === 1 ? "review" : "reviews"} ${DONE[status]}`, {
        description:
          skipped > 0
            ? `${count(skipped)} ${skipped === 1 ? "was" : "were"} already ${humanize(status).toLowerCase()}.`
            : undefined,
      });
    },
    onSettled: () => refresh(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => clientApi.reviews.remove(id),
    onMutate: (id) => begin([id], "DELETED"),
    onError: (error, _id, rollback) => fail(error, rollback, "Could not delete the review"),
    onSuccess: (_result, _id, rollback) => {
      land(rollback);
      toast.success("Review deleted");
    },
    onSettled: () => refresh(),
  });

  const bulkBlocked = !canModerate || chosen.some((review) => busy(review.id));

  return (
    <>
      <TableCard
        fill
        toolbar={
          // the strip `TableCard` grew a `toolbar` slot for: inside the border,
          // above the table, on the card's own px-3 gutter and type scale
          <div
            role="toolbar"
            aria-label="Bulk actions"
            className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5"
          >
            {/* one live region that is always there, so the count is announced */}
            <p aria-live="polite" className="text-muted-foreground mr-auto text-xs">
              {chosen.length > 0 ? (
                <>
                  <span className="text-foreground font-semibold tabular-nums">{count(chosen.length)}</span>{" "}
                  selected
                </>
              ) : (
                "Tick reviews to publish or reject several at once."
              )}
            </p>
            {chosen.length > 0 ? (
              <>
                {bulk.isPending ? (
                  <Loader2 aria-hidden className="text-muted-foreground size-3.5 animate-spin" />
                ) : null}
                <Button
                  size="sm"
                  className={TOOLBAR_BUTTON}
                  data-testid="bulk-publish"
                  disabled={bulkBlocked}
                  onClick={() => bulk.mutate({ ids: chosen.map((review) => review.id), status: "PUBLISHED" })}
                >
                  <Check />
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={TOOLBAR_BUTTON}
                  data-testid="bulk-reject"
                  disabled={bulkBlocked}
                  onClick={() => bulk.mutate({ ids: chosen.map((review) => review.id), status: "REJECTED" })}
                >
                  <X />
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  data-testid="review-select-all"
                  aria-label="Select every review on this page"
                  checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                  disabled={!canModerate || selectable.length === 0}
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked === true ? new Set(selectable.map((review) => review.id)) : new Set(),
                    )
                  }
                />
              </TableHead>
              {/* after the tick box, not before it: the control you act with
                  comes first, then the number you read by */}
              <OrdinalHead />
              <TableHead>Review</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Moderated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* `rows`, not `reviews`: a row hidden by an optimistic delete is
                gone from the page, so the rows under it take its number at once
                and settle when the refreshed page arrives */}
            {rows.map((review, i) => {
              const status = statusOf(review);
              const isBusy = busy(review.id);
              const isChosen = selected.has(review.id);

              return (
                <TableRow
                  key={review.id}
                  data-testid="review-row"
                  data-id={review.id}
                  data-status={status}
                  data-rating={review.rating}
                  data-state={isChosen ? "selected" : undefined}
                  aria-busy={isBusy || undefined}
                >
                  <TableCell>
                    <Checkbox
                      data-testid="review-select"
                      aria-label={`Select the review by ${review.author}`}
                      checked={isChosen}
                      disabled={!canModerate || isBusy}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked === true ? new Set(current).add(review.id) : without(current, [review.id]),
                        )
                      }
                    />
                  </TableCell>

                  <OrdinalCell n={from + i} />

                  {/* the tallest cell in the app: a byline plus up to three
                      clamped lines. It states py-2 so TableCard's `py-0` stands
                      aside and the text does not butt the rules. */}
                  <TableCell className="min-w-64 max-w-xl py-2 whitespace-normal">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{review.author}</span>
                      {review.handle ? (
                        <span className="text-muted-foreground">{review.handle}</span>
                      ) : null}
                      <time dateTime={review.createdAt} className="text-muted-foreground">
                        {at(review.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{review.body}</p>
                  </TableCell>

                  <TableCell>
                    <RatingStars rating={review.rating} />
                  </TableCell>

                  {/* name over slug - two lines, so it says py- */}
                  <TableCell className="py-1.5 leading-tight whitespace-normal">
                    {review.product ? (
                      <div className="grid">
                        <span>{review.product.name}</span>
                        <span className="text-muted-foreground font-mono">{review.product.slug}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Whole shop</span>
                    )}
                  </TableCell>

                  {/* who over when - two lines again */}
                  <TableCell className="py-1.5 leading-tight">
                    {review.moderatedAt ? (
                      <div className="grid">
                        <span className="max-w-40 truncate">
                          {review.moderatedBy
                            ? (review.moderatedBy.name ?? review.moderatedBy.email)
                            : "Not recorded"}
                        </span>
                        <time dateTime={review.moderatedAt} className="text-muted-foreground">
                          {at(review.moderatedAt)}
                        </time>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not yet</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      {isBusy ? (
                        <>
                          <Loader2 aria-hidden className="text-muted-foreground size-4 animate-spin" />
                          <span className="sr-only">Saving</span>
                        </>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          // the app's row-action shape, as ColorDialog and
                          // SizeDialog already draw it: 28px with a 14px glyph
                          className="[&_svg]:size-3.5"
                          data-testid="review-actions"
                          aria-label={`Actions for the review by ${review.author}`}
                          disabled={isBusy}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        // Radix hands focus back to the trigger as the menu
                        // closes; when that close is the one opening the delete
                        // dialog, it would steal focus out of the dialog
                        onCloseAutoFocus={(event) => {
                          if (confirmingDelete) event.preventDefault();
                        }}
                      >
                        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                          Move to
                        </DropdownMenuLabel>
                        {MOVES.map(({ to, label, testId, icon: Icon }) => (
                          <DropdownMenuItem
                            key={to}
                            data-testid={testId}
                            disabled={!canModerate || status === to}
                            onSelect={() => moderate.mutate({ id: review.id, status: to })}
                          >
                            <Icon />
                            {label}
                          </DropdownMenuItem>
                        ))}
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              data-testid="review-delete"
                              onSelect={() => {
                                setDeleteTarget(review);
                                setConfirmingDelete(true);
                              }}
                            >
                              <Trash2 />
                              Delete…
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>

      {/* One dialog for the table, a sibling of every menu rather than a child
          of one: a menu unmounts its portal on select, and anything inside it
          would go with it. */}
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent data-testid="review-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              The review by {deleteTarget?.author} is removed for good and cannot be restored from
              here. Rejecting it instead keeps it off the storefront. The audit log keeps a copy
              either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="review-delete-cancel">Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="review-delete-confirm"
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget.id);
              }}
            >
              <Trash2 />
              Delete review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
