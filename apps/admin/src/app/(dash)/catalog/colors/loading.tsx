import { useTranslations } from "next-intl";

import ListPage from "@/components/common/ListPage";
import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  const t = useTranslations("Colors");

  return (
    <ListPage>
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        dense
        fill
        ordinal
        rows={12}
        columns={[
          { label: t("columns.colour"), bar: "h-4 w-32" },
          { label: t("columns.slug"), bar: "h-4 w-24" },
          { label: t("columns.hex"), bar: "h-4 w-16" },
          { label: t("columns.products"), align: "right", bar: "h-4 w-6" },
          { label: t("columns.orderLines"), align: "right", bar: "h-4 w-8" },
          { label: t("columns.offered"), bar: "h-5 w-28 rounded-md" },
        ]}
      />
    </ListPage>
  );
}
