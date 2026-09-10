import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        columns={[
          { label: "Customer", bar: "h-4 w-40" },
          { label: "Company", bar: "h-4 w-28" },
          { label: "Orders", align: "right", bar: "h-4 w-8" },
          { label: "Lifetime value", align: "right", bar: "h-4 w-16" },
          { label: "Last order", align: "right", bar: "h-4 w-20" },
        ]}
      />
    </div>
  );
}
