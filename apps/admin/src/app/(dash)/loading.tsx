import { ListCardSkeleton, OverviewTilesSkeleton } from "@/components/overview/Skeletons";
import { LatestOrdersSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The overview's top half as the page draws it - its heading, the seven queue
 * tiles, and the attention list beside the latest orders - so nothing moves
 * when the page's own Suspense boundaries take over.
 */
export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-40" />
      <OverviewTilesSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCardSkeleton rows={5} />
        <LatestOrdersSkeleton />
      </div>
    </div>
  );
}
