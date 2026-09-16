import {
  QUOTE_ASSIGNEE_KEYWORDS,
  QUOTE_FOLLOW_UP_FILTERS,
  QUOTE_STATUSES,
} from "@inkhaus/shared/orders";
import { cn } from "cn";
import { AlarmClock, SearchX } from "lucide-react";
import Link from "next/link";

import FilterLinks from "@/components/common/FilterLinks";
import ListEmpty from "@/components/common/ListEmpty";
import ListHeader from "@/components/common/ListHeader";
import PageSizeLinks from "@/components/common/PageSizeLinks";
import { ROW_LINK } from "@/components/common/row-link";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import Pager from "@/components/Pager";
import { followUpState, formatFollowUp, todayUtc } from "@/components/quotes/quote-dates";
import QuoteStatusControl from "@/components/quotes/QuoteStatusControl";
import StatusFilterLinks from "@/components/StatusFilterLinks";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/api";
import { at, humanize, relative, usd } from "@/lib/format";
import { quotesLinkParams, quotesQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Bulk quotes — INKHAUS Back Office" };

const assigneeLabel = (value: string) => (value === "me" ? "Mine" : "Unassigned");

/**
 * Fully server rendered: the table is a projection of the URL, and every
 * filter is a link. The status control in each row is the one client leaf; it
 * refreshes this page when it lands.
 *
 * Each row is one link, stretched over the row, so a click anywhere opens the
 * quote - except on the status control, which sits above it.
 */
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // every field ends in .catch(), so this cannot throw
  const params = quotesQuerySchema.parse(await searchParams);
  const { data, meta } = await adminApi.quotes.list(params);
  const today = todayUtc();
  // what every control's link keeps: the parsed params, defaults left unspelled
  const linkParams = quotesLinkParams(params);

  return (
    <div className="space-y-6">
      <ListHeader
        title="Bulk quotes"
        meta={`${meta.total} total · page ${meta.page} of ${meta.pages}`}
        metaTestId="quotes-meta"
        actions={<PageSizeLinks base="/quotes" params={linkParams} active={params.limit} />}
      />

      <UrlSearchBox
        label="Search quotes"
        placeholder="Email, name or company"
        testId="quotes-search"
        clearTestId="quotes-search-clear"
      />

      <div className="space-y-3">
        <StatusFilterLinks
          base="/quotes"
          statuses={QUOTE_STATUSES}
          active={params.status}
          params={linkParams}
        />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <FilterLinks
            base="/quotes"
            param="assignee"
            values={QUOTE_ASSIGNEE_KEYWORDS}
            active={params.assignee}
            params={linkParams}
            ariaLabel="Filter by assignee"
            allLabel="Anyone"
            label={assigneeLabel}
          />
          <FilterLinks
            base="/quotes"
            param="followUp"
            values={QUOTE_FOLLOW_UP_FILTERS}
            active={params.followUp}
            params={linkParams}
            ariaLabel="Filter by follow-up"
            allLabel="Any follow-up"
            label={humanize}
          />
        </div>
      </div>

      {data.length === 0 ? (
        <ListEmpty
          icon={SearchX}
          title="No quotes match"
          description="Try another filter, or clear the search."
          reason="filtered"
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Estimate</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((quote) => {
                const followUp = followUpState(quote.followUpAt, quote.status, today);
                const title = quote.company ?? quote.name ?? quote.email;
                return (
                  <TableRow
                    key={quote.id}
                    className="relative"
                    data-testid="quote-row"
                    data-id={quote.id}
                    data-status={quote.status}
                    data-overdue={followUp === "overdue" ? "true" : undefined}
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      <time dateTime={quote.createdAt} title={at(quote.createdAt)}>
                        {relative(quote.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <Link
                        href={`/quotes/${quote.id}`}
                        data-testid="quote-row-link"
                        className={cn(ROW_LINK, "font-semibold")}
                      >
                        {title}
                      </Link>
                      <div className="text-muted-foreground truncate text-xs">
                        {[quote.company ? quote.name : null, quote.email]
                          .filter((part) => part && part !== title)
                          .join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {quote.product ? (
                        quote.product.name
                      ) : (
                        <span className="text-muted-foreground">No blank chosen</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{quote.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {quote.estimated !== null ? (
                        usd(quote.estimated)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {quote.assignee ? (
                        (quote.assignee.name ?? quote.assignee.email)
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {quote.followUpAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          {formatFollowUp(quote.followUpAt)}
                          {/* the word, not just the colour */}
                          {followUp === "overdue" ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/40 text-destructive"
                            >
                              <AlarmClock />
                              Overdue
                            </Badge>
                          ) : followUp === "today" ? (
                            <Badge variant="secondary">Today</Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* above the stretched row link, so it stays clickable */}
                    <TableCell className="relative z-10">
                      <QuoteStatusControl
                        id={quote.id}
                        status={quote.status}
                        convertedOrderNumber={quote.convertedOrderNumber}
                        label={`Status of the quote from ${title}`}
                      />
                      {quote.convertedOrderNumber ? (
                        <p className="text-muted-foreground mt-1 font-mono text-xs">
                          {quote.convertedOrderNumber}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pager base="/quotes" page={meta.page} pages={meta.pages} params={linkParams} />
    </div>
  );
}
