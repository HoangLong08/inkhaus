import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      {/* h-8, which is what UrlSearchBox and FilterLinks actually render; this
          drew an h-9 box and reflowed 4px the moment the real one arrived */}
      <Skeleton className="h-8 w-full max-w-sm" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <TableSkeleton
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
    </div>
  );
}
