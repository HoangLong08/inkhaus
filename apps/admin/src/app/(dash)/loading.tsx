import { LatestOrdersSkeleton, StatTilesSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-40" />
      <StatTilesSkeleton />
      <LatestOrdersSkeleton />
    </div>
  );
}
