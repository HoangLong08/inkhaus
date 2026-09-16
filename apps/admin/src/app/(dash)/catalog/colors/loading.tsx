import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        rows={12}
        columns={[
          { label: "Colour", bar: "h-4 w-32" },
          { label: "Slug", bar: "h-4 w-24" },
          { label: "Hex", bar: "h-4 w-16" },
          { label: "Products", align: "right", bar: "h-4 w-6" },
          { label: "Order lines", align: "right", bar: "h-4 w-8" },
          { label: "Offered", bar: "h-5 w-28 rounded-md" },
        ]}
      />
    </div>
  );
}
