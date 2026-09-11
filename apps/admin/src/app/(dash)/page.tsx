import { Suspense } from "react";

import LatestOrders from "@/components/overview/LatestOrders";
import NeedsAttention from "@/components/overview/NeedsAttention";
import OverviewTiles from "@/components/overview/OverviewTiles";
import QuoteFunnel from "@/components/overview/QuoteFunnel";
import RangeLinks from "@/components/overview/RangeLinks";
import RevenueSummary from "@/components/overview/RevenueSummary";
import RevenueTrend from "@/components/overview/RevenueTrend";
import {
  ListCardSkeleton,
  OverviewTilesSkeleton,
  RevenueSummarySkeleton,
  RevenueTrendSkeleton,
} from "@/components/overview/Skeletons";
import TopProducts from "@/components/overview/TopProducts";
import { LatestOrdersSkeleton } from "@/components/skeletons";
import { overviewQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Overview — INKHAUS Back Office" };

/**
 * The page an operator starts the day on: what is waiting on a person (the
 * queues and the attention list), then what the chosen range brought in and
 * earned. The range switch sits above the part it scopes and nothing else.
 *
 * Server-rendered except the chart, which needs a browser to measure itself.
 * Each block streams in its own Suspense boundary so a slow one holds up only
 * itself; every block but the latest orders reads the same cached stats call
 * (components/overview/data.ts), so the boundaries still cost the API one
 * request between them.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // cannot throw: an unknown or repeated ?range= reads as the default
  const params = overviewQuerySchema.parse(await searchParams);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>

      <Suspense fallback={<OverviewTilesSkeleton />}>
        <OverviewTiles params={params} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ListCardSkeleton rows={5} />}>
          <NeedsAttention params={params} />
        </Suspense>
        <Suspense fallback={<LatestOrdersSkeleton />}>
          <LatestOrders />
        </Suspense>
      </div>

      <section aria-labelledby="overview-performance" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="overview-performance" className="text-lg font-semibold tracking-tight">
            Performance
          </h2>
          <RangeLinks params={params} />
        </div>

        <Suspense fallback={<RevenueSummarySkeleton />}>
          <RevenueSummary params={params} />
        </Suspense>

        <Suspense fallback={<RevenueTrendSkeleton />}>
          <RevenueTrend params={params} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<ListCardSkeleton rows={5} />}>
            <TopProducts params={params} />
          </Suspense>
          <Suspense fallback={<ListCardSkeleton rows={4} />}>
            <QuoteFunnel params={params} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
