import { ListHeaderSkeleton, TableSkeleton, type SkeletonColumn } from "@/components/skeletons";

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
    <div className="space-y-6">
      <ListHeaderSkeleton />
      <TableSkeleton columns={QUOTE_COLUMNS} />
    </div>
  );
}
