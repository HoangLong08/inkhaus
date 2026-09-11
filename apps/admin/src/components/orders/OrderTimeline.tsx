"use client";

import { CircleDot, ExternalLink, MessageSquareText, Truck, type LucideIcon } from "lucide-react";

import { carrierLabel } from "@/components/order-detail/format";
import { useOrderDetail } from "@/components/order-detail/order-detail-query";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { at } from "@/lib/format";
import type { AdminOrderDetailEvent } from "@/lib/schemas/api";

const KIND: Record<AdminOrderDetailEvent["kind"], { icon: LucideIcon; label: string }> = {
  STATUS: { icon: CircleDot, label: "Status change" },
  NOTE: { icon: MessageSquareText, label: "Internal note" },
  TRACKING: { icon: Truck, label: "Tracking" },
};

/**
 * Everything that happened to the order, oldest first - status moves, the
 * tracking that went with them, and staff notes the customer never sees. One of
 * the client leaves on the order page, all reading the same cache entry the
 * server prefetched, so a move or a note shows up here the moment it is made.
 */
export default function OrderTimeline({ number }: { number: string }) {
  const { data: order } = useOrderDetail(number);

  // warm from the page's HydrationBoundary; the guard is for the type
  if (!order) return null;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="bg-muted/50 border-b px-4 py-2.5">
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Timeline
        </CardTitle>
      </CardHeader>

      {/* Exactly one <li> per event and nothing else in the list: e2e counts
          them. The empty state therefore sits outside it. */}
      <ol className="divide-y" data-testid="order-timeline">
        {order.timeline.map((event) => (
          <TimelineEvent key={event.id} event={event} />
        ))}
      </ol>
      {order.timeline.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">Nothing has happened to this order yet.</p>
      ) : null}
    </Card>
  );
}

function TimelineEvent({ event }: { event: AdminOrderDetailEvent }) {
  const { icon: Icon, label } = KIND[event.kind];

  return (
    <li
      data-testid="timeline-event"
      data-kind={event.kind}
      data-status={event.status}
      className="flex gap-3 px-4 py-2.5 text-sm"
    >
      <Icon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="sr-only">{label}:</span>
          {event.kind === "STATUS" ? <StatusBadge status={event.status} /> : null}
          {/* spelled out, not just a different icon: the operator must never
              mistake a staff note for something the customer can read */}
          {event.kind === "NOTE" ? <Badge variant="secondary">Internal</Badge> : null}
          {event.kind === "TRACKING" ? <TrackingLine event={event} /> : null}

          {/* the server renders this in its own time zone and the browser in
              the operator's; the browser's is the one worth showing */}
          <time
            dateTime={event.at}
            suppressHydrationWarning
            className="text-muted-foreground ml-auto text-xs"
          >
            {at(event.at)}
          </time>
        </div>

        {event.note && event.kind !== "TRACKING" ? (
          <p className="text-muted-foreground whitespace-pre-wrap break-words">{event.note}</p>
        ) : null}

        {event.actor ? (
          <p className="text-muted-foreground text-xs">
            by{" "}
            <span className="text-foreground font-medium" data-testid="timeline-actor">
              {event.actor.name ?? event.actor.email}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** carrier and number, linked to the carrier's own page when there is one */
function TrackingLine({ event }: { event: AdminOrderDetailEvent }) {
  const tracking = event.tracking;
  if (!tracking) return <span className="font-mono">{event.note}</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span className="font-medium">{carrierLabel(tracking.carrier)}</span>
      {tracking.url ? (
        <Button asChild variant="link" size="sm" className="h-auto p-0 font-mono">
          <a
            href={tracking.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="timeline-tracking-link"
          >
            {tracking.number}
            <ExternalLink aria-hidden />
            <span className="sr-only">(opens the carrier&apos;s site)</span>
          </a>
        </Button>
      ) : (
        <span className="font-mono">{tracking.number}</span>
      )}
    </span>
  );
}
