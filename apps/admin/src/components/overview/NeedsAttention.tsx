import { CalendarClock, CircleCheck, Hourglass, Timer, type LucideIcon } from "lucide-react";
import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { relative } from "@/lib/format";
import type { OverviewQuery } from "@/lib/schemas/params";

import { getOverview } from "./data";
import { longDay } from "./labels";

type Kind = "overdue-follow-up" | "stale-quote" | "stuck-order";

/**
 * What is waiting on a person, oldest first, five of each at most: follow-ups
 * somebody promised and missed, new quotes nobody has picked up in two days,
 * and paid orders that have not moved in three. Every item opens the record it
 * is about. Right now, whatever the range says.
 */
export default async function NeedsAttention({ params }: { params: OverviewQuery }) {
  const { attention } = await getOverview(params);
  if (!attention) return null;

  const { overdueFollowUps, staleQuotes, stuckOrders } = attention;
  const nothing = overdueFollowUps.length + staleQuotes.length + stuckOrders.length === 0;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle>
          <h2 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
            Needs attention
          </h2>
        </CardTitle>
      </CardHeader>

      {nothing ? (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheck />
            </EmptyMedia>
            <EmptyTitle>Nothing is waiting</EmptyTitle>
            <EmptyDescription>
              No missed follow-ups, no new quote older than two days, and no paid order sitting
              still for three.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="divide-y">
          {overdueFollowUps.length > 0 ? (
            <Group icon={CalendarClock} title="Follow-ups overdue">
              {overdueFollowUps.map((quote) => (
                <Item
                  key={quote.id}
                  kind="overdue-follow-up"
                  href={`/quotes/${quote.id}`}
                  id={quote.id}
                  email={quote.email}
                  when={`due ${longDay(quote.followUpAt)}`}
                >
                  <Who name={quote.name} email={quote.email} />
                  <span className="text-muted-foreground text-xs">
                    {quote.assignee ? (quote.assignee.name ?? quote.assignee.email) : "Unassigned"}
                  </span>
                </Item>
              ))}
            </Group>
          ) : null}

          {staleQuotes.length > 0 ? (
            <Group icon={Hourglass} title="New quotes waiting over 48 hours">
              {staleQuotes.map((quote) => (
                <Item
                  key={quote.id}
                  kind="stale-quote"
                  href={`/quotes/${quote.id}`}
                  id={quote.id}
                  email={quote.email}
                  when={`came in ${relative(quote.createdAt)}`}
                >
                  <Who name={quote.name} email={quote.email} />
                  {quote.company ? (
                    <span className="text-muted-foreground text-xs">{quote.company}</span>
                  ) : null}
                </Item>
              ))}
            </Group>
          ) : null}

          {stuckOrders.length > 0 ? (
            <Group icon={Timer} title="Paid orders unmoved for 3 days">
              {stuckOrders.map((order) => (
                <Item
                  key={order.number}
                  kind="stuck-order"
                  href={`/orders/${order.number}`}
                  number={order.number}
                  when={`last changed ${relative(order.since)}`}
                >
                  <span className="font-mono text-sm font-semibold">{order.number}</span>
                  <StatusBadge status={order.status} />
                </Item>
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Group({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-muted-foreground flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

function Item({
  kind,
  href,
  id,
  email,
  number,
  when,
  children,
}: {
  kind: Kind;
  href: string;
  /** the machine values a test finds the item by, on data-* */
  id?: string;
  email?: string;
  number?: string;
  when: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-accent flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition"
        data-testid="attention-item"
        data-kind={kind}
        data-id={id}
        data-email={email}
        data-number={number}
      >
        {children}
        <span className="text-muted-foreground ml-auto text-xs">{when}</span>
      </Link>
    </li>
  );
}

/** the person's name when the quote has one, with the address beside it */
function Who({ name, email }: { name: string | null; email: string }) {
  return (
    <>
      <span className="truncate text-sm font-medium">{name ?? email}</span>
      {name ? <span className="text-muted-foreground truncate text-sm">{email}</span> : null}
    </>
  );
}
