import { useTranslations } from "next-intl";

import ListPage from "@/components/common/ListPage";
import { ListFooterSkeleton, ListHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `useTranslations`, not `getTranslations`: a loading.tsx is a Suspense
 * fallback and cannot be async. It is still a Server Component, so the hook
 * reads the whole catalogue from i18n/request.ts - the CHROME_NAMESPACES
 * budget is about what crosses to the browser and does not apply here. Which
 * is just as well, because a page's own nested provider lives inside
 * page.tsx and could never wrap its own fallback.
 */
export default function Loading() {
  const t = useTranslations("Catalog");

  return (
    <ListPage>
      {/* the chips live in the toolbar row below, not under the heading */}
      <ListHeaderSkeleton chips={0} />
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-64" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <TableSkeleton
        dense
        fill
        ordinal
        columns={[
          { label: t("columns.product"), bar: "h-4 w-40" },
          { label: t("columns.category"), bar: "h-4 w-20" },
          { label: t("columns.price"), align: "right", bar: "h-4 w-14" },
          { label: t("columns.colors"), align: "right", bar: "h-4 w-6" },
          { label: t("columns.orders"), align: "right", bar: "h-4 w-8" },
          { label: t("columns.status"), bar: "h-5 w-20 rounded-md" },
          { label: t("columns.edited"), align: "right", bar: "h-4 w-20" },
        ]}
      />
      <ListFooterSkeleton />
    </ListPage>
  );
}
