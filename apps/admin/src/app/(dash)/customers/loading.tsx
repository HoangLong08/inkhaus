import ListPage from "@/components/common/ListPage";
import { ListFooterSkeleton, ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ListPage>
      <ListHeaderSkeleton chips={0} />
      {/* the toolbar row the page renders: one h-8 search box, three h-8 chips */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <TableSkeleton
        dense
        fill
        columns={[
          { label: "Customer", bar: "h-4 w-48" },
          { label: "Name", bar: "h-4 w-28" },
          { label: "Orders", align: "right", bar: "h-4 w-8" },
          { label: "Lifetime value", align: "right", bar: "h-4 w-16" },
          { label: "Last order", align: "right", bar: "h-4 w-20" },
          { label: "Last sign-in", align: "right", bar: "h-4 w-20" },
          { label: "Created", align: "right", bar: "h-4 w-20" },
        ]}
      />
      <ListFooterSkeleton />
    </ListPage>
  );
}
