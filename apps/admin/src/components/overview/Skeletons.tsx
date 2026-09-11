import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-ins for the overview's sections, shaped like the markup they hold the
 * place of so nothing reflows when the stats land. The latest-orders strip uses
 * `LatestOrdersSkeleton` from components/skeletons, which was already its shape.
 */

/** four order queues, drafts, new quotes, pending reviews - the grid OverviewTiles draws */
export function OverviewTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => (
        <Card key={i} className="gap-2">
          <CardHeader className="pb-0">
            <Skeleton className="h-5 w-24 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RevenueSummarySkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="gap-1 py-4">
            <CardHeader className="px-4">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="space-y-1.5 px-4">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** the card RevenueTrend draws: a heading, a line of description, both charts */
export function RevenueTrendSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-90 w-full" />
      </CardContent>
    </Card>
  );
}

/** a card with a heading and a few rows - top products, the funnel, the attention list */
export function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-16" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
