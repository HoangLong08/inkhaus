import ListPage from "@/components/common/ListPage";
import { ListFooterSkeleton, ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ListPage>
      <ListHeaderSkeleton chips={0} />
      {/* the toolbar: a search box, four status chips and six rating chips */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <TableSkeleton
        dense
        fill
        ordinal
        columns={[
          { label: "Review", bar: "h-4 w-64" },
          { label: "Rating", bar: "h-4 w-24" },
          { label: "Product", bar: "h-4 w-28" },
          { label: "Moderated", bar: "h-4 w-24" },
          { label: "Status", bar: "h-5 w-24 rounded-md" },
        ]}
      />
      <ListFooterSkeleton />
    </ListPage>
  );
}
