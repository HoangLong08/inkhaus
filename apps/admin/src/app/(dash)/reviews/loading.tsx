import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={4} />
      <TableSkeleton
        columns={[
          { label: "Review", bar: "h-4 w-48" },
          { label: "Rating", bar: "h-4 w-16" },
          { label: "Product", bar: "h-4 w-28" },
          { label: "Status", bar: "h-5 w-20 rounded-full" },
        ]}
      />
    </div>
  );
}
