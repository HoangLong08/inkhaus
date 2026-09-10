import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        rows={8}
        columns={[
          { label: "Code", bar: "h-4 w-10" },
          { label: "Label", bar: "h-4 w-20" },
          { label: "Upcharge", align: "right", bar: "h-4 w-12" },
        ]}
      />
    </div>
  );
}
