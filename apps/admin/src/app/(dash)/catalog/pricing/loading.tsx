import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TableSkeleton
          rows={7}
          columns={[
            { label: "From quantity", bar: "h-9 w-full" },
            { label: "Discount (%)", bar: "h-9 w-full" },
          ]}
        />
        <TableSkeleton
          rows={7}
          columns={[
            { label: "From", bar: "h-4 w-10" },
            { label: "Discount", align: "right", bar: "h-4 w-12" },
            { label: "Unit price", align: "right", bar: "h-4 w-14" },
          ]}
        />
      </div>
    </div>
  );
}
