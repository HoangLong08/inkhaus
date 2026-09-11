import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        rows={5}
        columns={[
          { label: "Member", bar: "h-4 w-40" },
          { label: "Role", bar: "h-8 w-28" },
          { label: "Access", bar: "h-5 w-16" },
          { label: "Last sign-in", bar: "h-4 w-20" },
          { label: "Invited by", bar: "h-4 w-24" },
          { label: "Sessions", align: "right", bar: "h-4 w-6" },
        ]}
      />
    </div>
  );
}
