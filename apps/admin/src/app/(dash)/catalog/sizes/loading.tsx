import { useTranslations } from "next-intl";

import ListPage from "@/components/common/ListPage";
import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  const t = useTranslations("Sizes");

  return (
    <ListPage>
      <ListHeaderSkeleton chips={0} />
      <TableSkeleton
        dense
        fill
        ordinal
        rows={8}
        columns={[
          { label: t("columns.code"), bar: "h-4 w-10" },
          { label: t("columns.label"), bar: "h-4 w-20" },
          { label: t("columns.upcharge"), align: "right", bar: "h-4 w-12" },
          { label: t("columns.sort"), align: "right", bar: "h-4 w-6" },
          { label: t("columns.products"), align: "right", bar: "h-4 w-6" },
        ]}
      />
    </ListPage>
  );
}
