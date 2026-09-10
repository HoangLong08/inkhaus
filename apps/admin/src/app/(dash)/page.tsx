import { Suspense } from "react";

import LatestOrders from "@/components/overview/LatestOrders";
import OverviewTiles from "@/components/overview/OverviewTiles";
import { LatestOrdersSkeleton, StatTilesSkeleton } from "@/components/skeletons";

export const metadata = { title: "Overview — INKHAUS Back Office" };

/**
 * Nothing on this page is interactive, so nothing here is a client component -
 * a spinner is not a reason to ship a bundle.
 *
 * The six API reads used to sit behind one Promise.all, which meant the whole
 * page waited on the slowest of them. Two Suspense boundaries let the tiles and
 * the recent list arrive independently, and each brings its own skeleton.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>

      <Suspense fallback={<StatTilesSkeleton />}>
        <OverviewTiles />
      </Suspense>

      <Suspense fallback={<LatestOrdersSkeleton />}>
        <LatestOrders />
      </Suspense>
    </div>
  );
}
