import ListPage from "@/components/common/ListPage";
import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <ListPage>
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        dense
        fill
        ordinal
        rows={8}
        columns={[
          { label: "Code", bar: "h-4 w-10" },
          { label: "Label", bar: "h-4 w-20" },
          { label: "Upcharge", align: "right", bar: "h-4 w-12" },
          { label: "Sort", align: "right", bar: "h-4 w-6" },
          { label: "Products", align: "right", bar: "h-4 w-6" },
        ]}
      />
    </ListPage>
  );
}
