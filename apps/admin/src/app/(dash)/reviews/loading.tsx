import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* four status chips and six rating chips */}
      <ListHeaderSkeleton chips={10} />
      <TableSkeleton
        columns={[
          { label: "Review", bar: "h-4 w-64" },
          { label: "Rating", bar: "h-4 w-24" },
          { label: "Product", bar: "h-4 w-28" },
          { label: "Moderated", bar: "h-4 w-24" },
          { label: "Status", bar: "h-5 w-20 rounded-full" },
        ]}
      />
    </div>
  );
}
