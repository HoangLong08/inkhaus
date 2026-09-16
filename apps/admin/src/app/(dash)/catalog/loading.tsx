import ListPage from "@/components/common/ListPage";
import { ListFooterSkeleton, ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ListPage>
      {/* the chips live in the toolbar row below, not under the heading */}
      <ListHeaderSkeleton chips={0} />
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-64" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <TableSkeleton
        dense
        fill
        columns={[
          { label: "Product", bar: "h-4 w-40" },
          { label: "Category", bar: "h-4 w-20" },
          { label: "Price", align: "right", bar: "h-4 w-14" },
          { label: "Colours", align: "right", bar: "h-4 w-6" },
          { label: "Orders", align: "right", bar: "h-4 w-8" },
          { label: "Status", bar: "h-5 w-20 rounded-md" },
          { label: "Edited", align: "right", bar: "h-4 w-20" },
        ]}
      />
      <ListFooterSkeleton />
    </ListPage>
  );
}
