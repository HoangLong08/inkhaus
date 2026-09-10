import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        rows={5}
        columns={[
          { label: "Member", bar: "h-4 w-40" },
          { label: "Role", bar: "h-4 w-16" },
          { label: "Status", bar: "h-5 w-16 rounded-full" },
          { label: "Sessions", align: "right", bar: "h-4 w-8" },
        ]}
      />
    </div>
  );
}
