import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={3} />
      <TableSkeleton
        columns={[
          { label: "Product", bar: "h-4 w-40" },
          { label: "Category", bar: "h-4 w-20" },
          { label: "Price", align: "right", bar: "h-4 w-12" },
          { label: "Status", bar: "h-5 w-16 rounded-full" },
        ]}
      />
    </div>
  );
}
