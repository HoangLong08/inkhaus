import { QUOTE_STATUSES } from "@inkhaus/shared/orders";
import { SearchX } from "lucide-react";

import Pager from "@/components/Pager";
import QuoteStatusControl from "@/components/quotes/QuoteStatusControl";
import StatusFilterLinks from "@/components/StatusFilterLinks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { adminApi } from "@/lib/api";
import { at, humanize, usd } from "@/lib/format";
import { quotesQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Bulk quotes — INKHAUS Back Office" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = quotesQuerySchema.parse(await searchParams);
  const { data, meta } = await adminApi.quotes(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Bulk quotes</h1>
        <p className="text-muted-foreground text-sm" data-testid="quotes-meta">
          {meta.total} total · page {meta.page} of {meta.pages}
        </p>
      </div>

      <StatusFilterLinks base="/quotes" statuses={QUOTE_STATUSES} active={params.status} />

      {data.length === 0 ? (
        <Card>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No quotes match this filter</EmptyTitle>
              <EmptyDescription>Pick a different status to see more.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.map((quote) => (
            <li key={quote.id}>
              <Card data-testid="quote-card" data-id={quote.id} className="gap-3">
                <CardHeader className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <CardTitle>
                    <Button asChild variant="link" className="h-auto p-0 font-semibold">
                      <a href={`mailto:${quote.email}`}>{quote.email}</a>
                    </Button>
                  </CardTitle>
                  {quote.name ? (
                    <span className="text-muted-foreground text-sm">{quote.name}</span>
                  ) : null}
                  {quote.company ? (
                    <span className="text-muted-foreground text-sm">{quote.company}</span>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {at(quote.createdAt)}
                  </span>
                </CardHeader>

                <CardContent className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    <span className="text-foreground font-semibold tabular-nums">
                      {quote.quantity}
                    </span>{" "}
                    units
                    {quote.productSlug ? ` · ${quote.productSlug}` : " · no blank chosen"}
                    {quote.method ? ` · ${humanize(quote.method)}` : ""}
                    {quote.estimated !== null ? (
                      <>
                        {" "}
                        · quoted{" "}
                        <span className="text-foreground font-semibold tabular-nums">
                          {usd(quote.estimated)}
                        </span>
                      </>
                    ) : null}
                  </p>

                  {quote.message ? (
                    <blockquote className="bg-muted text-muted-foreground whitespace-pre-wrap rounded-md px-3 py-2 text-sm">
                      {quote.message}
                    </blockquote>
                  ) : null}
                </CardContent>

                <CardFooter>
                  <QuoteStatusControl id={quote.id} status={quote.status} />
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pager
        base="/quotes"
        page={meta.page}
        pages={meta.pages}
        params={{ status: params.status }}
      />
    </div>
  );
}
