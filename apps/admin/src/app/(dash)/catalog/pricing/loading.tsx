import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        rows={7}
        columns={[
          { label: "From quantity", bar: "h-4 w-12" },
          { label: "Discount", align: "right", bar: "h-4 w-12" },
        ]}
      />
    </div>
  );
}
