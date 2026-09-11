import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { methodLabel } from "@/components/order-detail/format";
import AssigneeSelect from "@/components/quotes/AssigneeSelect";
import ConvertQuoteDialog from "@/components/quotes/ConvertQuoteDialog";
import FollowUpPicker from "@/components/quotes/FollowUpPicker";
import QuoteNotesForm from "@/components/quotes/QuoteNotesForm";
import { QuoteStatusLive } from "@/components/quotes/QuoteStatusControl";
import QuoteTimeline from "@/components/quotes/QuoteTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { adminApi, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { at, count, usd } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { quoteIdSchema } from "@/lib/schemas/params";

export const metadata = { title: "Quote — INKHAUS Back Office" };

const heading = "text-muted-foreground text-xs font-semibold uppercase tracking-wide";

/**
 * One quote, and everything that can be done about it.
 *
 * Same shape as the order page: one server fetch dehydrated into the client
 * cache, and small client leaves - status, assignee, follow-up, notes,
 * timeline, convert - that all read that one entry, so a write in any of them
 * moves the others. What cannot change from here (the request itself, the
 * customer) stays server rendered.
 *
 * The staff directory and the catalog are reference data the leaves need but
 * never refetch, so they arrive as props rather than as queries.
 */
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: raw }, user] = await Promise.all([
    params,
    // cached by the DAL, so this costs nothing beyond the layout's own call
    requireAdmin(),
  ]);

  const parsed = quoteIdSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const id = parsed.data;

  const queryClient = getQueryClient();
  const mayConvert = can(user.role, "quotes.convert");

  // All at once. The convert form's data is read whenever this role may
  // convert, before knowing whether this quote still can be - most can, and
  // waiting to find out would put a second round trip in front of every view.
  const [quote, directory, convertOptions] = await Promise.all([
    queryClient
      .fetchQuery({
        queryKey: queryKeys.quotes.detail(id),
        queryFn: () => adminApi.quotes.get(id),
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) notFound();
        throw err;
      }),
    adminApi.lookups.staffDirectory(),
    // products with their prices and the ladder - all the dialog's estimate needs
    mayConvert ? adminApi.lookups.catalogOptions() : null,
  ]);

  const drift =
    quote.estimated !== null && quote.liveEstimate !== null
      ? quote.liveEstimate - quote.estimated
      : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/quotes" data-testid="quote-back">
              <ArrowLeft />
              Bulk quotes
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{quote.company ?? quote.email}</h1>
            <QuoteStatusLive id={id} label="Quote status" />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {quote.name ? `${quote.name} · ` : ""}
            {quote.company ? `${quote.email} · ` : ""}
            received {at(quote.createdAt)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className={heading}>The request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quote.message ? (
                  <blockquote className="border-l-2 pl-4 text-sm italic whitespace-pre-wrap">
                    {quote.message}
                  </blockquote>
                ) : (
                  <p className="text-muted-foreground text-sm">No message with this quote.</p>
                )}

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <Fact label="Product">
                    {quote.product ? quote.product.name : <Muted>No blank chosen</Muted>}
                  </Fact>
                  <Fact label="Quantity">
                    <span className="tabular-nums">{count(quote.quantity)}</span>
                  </Fact>
                  <Fact label="Method">
                    {quote.method ? (
                      methodLabel(quote.method)
                    ) : (
                      <Muted>Not chosen</Muted>
                    )}
                  </Fact>
                  <Fact label="Quoted">
                    {quote.estimated !== null ? (
                      <span className="tabular-nums">{usd(quote.estimated)}</span>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </Fact>
                </dl>
              </CardContent>
              {quote.liveEstimate !== null ? (
                <CardFooter className="text-muted-foreground border-t text-sm">
                  <p>
                    At today&apos;s prices:{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {usd(quote.liveEstimate)}
                    </span>
                    {drift !== null && Math.abs(drift) >= 0.01
                      ? ` - ${usd(Math.abs(drift))} ${drift > 0 ? "more" : "less"} than quoted.`
                      : drift !== null
                        ? " - unchanged since it was quoted."
                        : ""}
                  </p>
                </CardFooter>
              ) : null}
            </Card>

            <QuoteTimeline id={id} />

            <Card>
              <CardContent>
                <QuoteNotesForm id={id} me={{ id: user.id, name: user.name, email: user.email }} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className={heading}>Working it</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AssigneeSelect id={id} directory={directory} meId={user.id} />
                <FollowUpPicker id={id} />
                <Separator />
                <ConvertQuoteDialog
                  id={id}
                  role={user.role}
                  options={convertOptions}
                  suggested={{ productSlug: quote.product?.slug ?? null, method: quote.method }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className={heading}>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-semibold">{quote.customer?.name ?? quote.name ?? quote.email}</p>
                {quote.customer?.company ?? quote.company ? (
                  <p className="text-muted-foreground">{quote.customer?.company ?? quote.company}</p>
                ) : null}
                <p>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <a href={`mailto:${quote.email}`} data-testid="quote-email">
                      {quote.email}
                    </a>
                  </Button>
                </p>
                {quote.customer?.phone ? (
                  <p className="text-muted-foreground">{quote.customer.phone}</p>
                ) : null}
                {quote.customer ? (
                  <p className="text-muted-foreground">
                    {quote.customer.orderCount === 0
                      ? "No orders yet"
                      : `${count(quote.customer.orderCount)} order${quote.customer.orderCount === 1 ? "" : "s"}`}
                  </p>
                ) : null}
              </CardContent>
              {quote.customer ? (
                <CardFooter>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/customers/${quote.customer.id}`} data-testid="quote-customer-link">
                      View customer
                    </Link>
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
