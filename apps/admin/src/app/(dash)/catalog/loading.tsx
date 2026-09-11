import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={9} />
      <TableSkeleton
        columns={[
          { label: "Product", bar: "h-4 w-40" },
          { label: "Category", bar: "h-4 w-20" },
          { label: "Price", align: "right", bar: "h-4 w-14" },
          { label: "Colours", align: "right", bar: "h-4 w-6" },
          { label: "Orders", align: "right", bar: "h-4 w-8" },
          { label: "Status", bar: "h-5 w-16 rounded-full" },
          { label: "Edited", align: "right", bar: "h-4 w-20" },
        ]}
      />
    </div>
  );
}
