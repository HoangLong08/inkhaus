import { useTranslations } from "next-intl";

import { ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  const t = useTranslations("Tiers");

  return (
    <div className="space-y-6">
      <ListHeaderSkeleton chips={0} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TableSkeleton
          rows={7}
          columns={[
            { label: t("ladder.from"), bar: "h-9 w-full" },
            { label: t("ladder.discount"), bar: "h-9 w-full" },
          ]}
        />
        <TableSkeleton
          rows={7}
          columns={[
            { label: t("preview.from"), bar: "h-4 w-10" },
            { label: t("preview.discount"), align: "right", bar: "h-4 w-12" },
            { label: t("preview.unitPrice"), align: "right", bar: "h-4 w-14" },
          ]}
        />
      </div>
    </div>
  );
}
