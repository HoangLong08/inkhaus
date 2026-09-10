import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        columns={[
          { label: "Colour", bar: "h-4 w-32" },
          { label: "Slug", bar: "h-4 w-24" },
          { label: "Status", bar: "h-5 w-16 rounded-full" },
        ]}
      />
    </div>
  );
}
