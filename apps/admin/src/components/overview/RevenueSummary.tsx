import { cn } from "cn";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { count, usd } from "@/lib/format";
import type { OverviewQuery } from "@/lib/schemas/params";
import { hrefWith } from "@/lib/url";

import { getOverview } from "./data";
import { dayRange } from "./labels";

/**
 * What the range earned. Revenue is the order total - shipping and tax
 * included - of every order placed in the range that has been paid for and is
 * still paid (paid, in production, shipped, delivered). Refunds sit beside it
 * rather than being netted out, so neither number hides the other.
 *
 * Only Refunded links anywhere: it is the one figure a single orders filter
 * reproduces exactly. The others span four statuses, and a link to a list that
 * shows a different number is worse than none.
 */
export default async function RevenueSummary({ params }: { params: OverviewQuery }) {
  const { range, revenue, orders } = await getOverview(params);
  if (!range || !revenue) return null;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">{dayRange(range.from, range.to)} · UTC days</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Revenue"
          value={usd(revenue.gross)}
          raw={revenue.gross}
          testId="revenue-total"
          note={`from ${count(revenue.orders)} paid ${revenue.orders === 1 ? "order" : "orders"}`}
        />
        <Figure
          label="Paid orders"
          value={count(revenue.orders)}
          raw={revenue.orders}
          note={orders.placed === undefined ? undefined : `of ${count(orders.placed)} placed`}
        />
        <Figure
          label="Average order"
          value={usd(revenue.averageOrder)}
          raw={revenue.averageOrder}
          note="revenue ÷ paid orders"
        />
        <Figure
          label="Refunded"
          value={usd(revenue.refunded)}
          raw={revenue.refunded}
          note="placed in this range, since refunded"
          href={hrefWith("/orders", {}, { status: "REFUNDED", from: range.from, to: range.to })}
        />
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  raw,
  note,
  href,
  testId,
}: {
  label: string;
  /** the formatted figure */
  value: string;
  /** the same figure unformatted, on `data-value` */
  raw: number;
  note?: string;
  href?: string;
  testId?: string;
}) {
  const card = (
    <Card
      className={cn("h-full gap-1 py-4", href && "hover:border-foreground/30 transition hover:shadow-sm")}
    >
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0.5 px-4">
        <p className="text-2xl font-semibold" data-testid={testId} data-value={raw}>
          {value}
        </p>
        {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
