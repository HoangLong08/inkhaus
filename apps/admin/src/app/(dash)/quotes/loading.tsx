import ListPage from "@/components/common/ListPage";
import {
  ListFooterSkeleton,
  ListHeaderSkeleton,
  TableSkeleton,
  type SkeletonColumn,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** the real table's columns, so nothing moves when the rows land */
const QUOTE_COLUMNS: SkeletonColumn[] = [
  { label: "Received", bar: "h-4 w-16" },
  { label: "Customer", bar: "h-4 w-40" },
  { label: "Product", bar: "h-4 w-32" },
  { label: "Qty", align: "right", bar: "h-4 w-8" },
  { label: "Estimate", align: "right", bar: "h-4 w-16" },
  { label: "Assignee", bar: "h-4 w-24" },
  { label: "Follow-up", bar: "h-4 w-20" },
  { label: "Status", bar: "h-8 w-44" },
];

export default function Loading() {
  return (
    <ListPage>
      {/* the status chips are in the toolbar row below, not under the heading */}
      <ListHeaderSkeleton chips={0} />
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-64" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <TableSkeleton dense fill columns={QUOTE_COLUMNS} />
      <ListFooterSkeleton />
    </ListPage>
  );
}
