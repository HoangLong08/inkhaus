"use client";

import type { QuoteEventKindCode } from "@inkhaus/shared/orders";
import {
  CalendarClock,
  CircleDot,
  Inbox,
  PackageCheck,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminQuoteEvent } from "@/lib/api";
import { at } from "@/lib/format";

import { formatFollowUp } from "./quote-dates";
import { PENDING_EVENT_PREFIX } from "./QuoteNotesForm";
import { useQuoteDetail } from "./useQuoteDetail";

/** the entry drawn from the quote's own createdAt - there is no CREATED event */
type Kind = QuoteEventKindCode | "RECEIVED";

const ICON: Record<Kind, LucideIcon> = {
  RECEIVED: Inbox,
  STATUS: CircleDot,
  ASSIGNED: UserRound,
  FOLLOW_UP: CalendarClock,
  NOTE: StickyNote,
  CONVERTED: PackageCheck,
};

function Body({ event }: { event: AdminQuoteEvent }) {
  switch (event.kind) {
    case "STATUS":
      return (
        <span className="inline-flex items-center gap-2">
          Marked {event.status ? <StatusBadge status={event.status} /> : null}
        </span>
      );
    case "ASSIGNED":
      return <span>{event.note === "Unassigned" ? "Unassigned" : `Assigned to ${event.note}`}</span>;
    case "FOLLOW_UP":
      return (
        <span>
          {event.note ? `Follow-up set for ${formatFollowUp(event.note)}` : "Follow-up cleared"}
        </span>
      );
    case "CONVERTED":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          Converted to order
          {event.note ? (
            <Button asChild variant="link" size="sm" className="h-auto p-0 font-mono">
              <Link href={`/orders/${encodeURIComponent(event.note)}`} data-testid="quote-event-order">
                {event.note}
              </Link>
            </Button>
          ) : null}
        </span>
      );
    case "NOTE":
      return <p className="whitespace-pre-wrap">{event.note}</p>;
  }
}

/**
 * The quote's history, oldest first - the same direction as the order
 * timeline, so the newest entry sits right above the note box that adds one.
 * Every entry names who did it; "Received" is the one nobody did.
 */
export default function QuoteTimeline({ id }: { id: string }) {
  const { data: quote } = useQuoteDetail(id);

  // warm from the page's HydrationBoundary; the guard is for the type
  if (!quote) return null;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="bg-muted/50 border-b px-4 py-2.5">
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          History
        </CardTitle>
      </CardHeader>
      <ol className="divide-y" data-testid="quote-timeline">
        <Entry kind="RECEIVED" when={quote.createdAt}>
          <span>Quote received</span>
        </Entry>
        {quote.events.map((event) => (
          <Entry
            key={event.id}
            kind={event.kind}
            when={event.at}
            actor={event.actor}
            pending={event.id.startsWith(PENDING_EVENT_PREFIX)}
          >
            <Body event={event} />
          </Entry>
        ))}
      </ol>
    </Card>
  );
}

function Entry({
  kind,
  when,
  actor,
  pending = false,
  children,
}: {
  kind: Kind;
  when: string;
  actor?: AdminQuoteEvent["actor"];
  pending?: boolean;
  children: React.ReactNode;
}) {
  const Icon = ICON[kind];
  return (
    <li
      data-testid="quote-event"
      data-kind={kind}
      data-pending={pending ? "true" : undefined}
      className={cn("flex gap-3 px-4 py-2.5 text-sm", pending && "opacity-60")}
    >
      <Icon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="min-w-0">{children}</div>
        <p className="text-muted-foreground text-xs">
          {actor ? `${actor.name ?? actor.email} · ` : null}
          {at(when)}
        </p>
      </div>
    </li>
  );
}
