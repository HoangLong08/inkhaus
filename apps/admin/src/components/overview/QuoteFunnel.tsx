import { QUOTE_STATUSES } from "@inkhaus/shared/orders";
import { FileText } from "lucide-react";

import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { count, humanize, pct } from "@/lib/format";
import type { OverviewQuery } from "@/lib/schemas/params";

import { getOverview } from "./data";

/**
 * The bulk quotes created in the range, by where each stands now, and how many
 * of the decided ones were won. Counts and rate describe the same set, so the
 * bars add up to the "created" figure and the rate can be checked against them
 * - all-time statuses beside an in-range rate could not be.
 */
export default async function QuoteFunnel({ params }: { params: OverviewQuery }) {
  const { quotes } = await getOverview(params);
  const { created, createdByStatus, conversionRate } = quotes;
  if (created === undefined || !createdByStatus || conversionRate === undefined) return null;

  return (
    <Card data-testid="quote-funnel" data-created={created}>
      <CardHeader>
        <CardTitle>
          <h3>Bulk quotes</h3>
        </CardTitle>
        <CardDescription>
          {count(created)} created in this range, by where they stand now.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {created === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No quotes came in</EmptyTitle>
              <EmptyDescription>Nobody asked for a bulk quote during this range.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ul className="space-y-3">
              {QUOTE_STATUSES.map((status) => {
                const n = createdByStatus[status] ?? 0;
                return (
                  <li key={status} className="space-y-1.5" data-status={status} data-count={n}>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={status} />
                      <span className="text-sm font-semibold tabular-nums">{count(n)}</span>
                    </div>
                    <Progress
                      value={(n / created) * 100}
                      aria-label={`${humanize(status)}: ${pct(n / created)} of quotes created`}
                    />
                  </li>
                );
              })}
            </ul>

            <Separator />

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-sm">Conversion</span>
              <span className="text-2xl font-semibold" data-conversion={conversionRate ?? ""}>
                {conversionRate === null ? "—" : pct(conversionRate)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {conversionRate === null
                ? "None of them has been won or lost yet."
                : "Won out of won and lost. Quotes still open count neither way."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
