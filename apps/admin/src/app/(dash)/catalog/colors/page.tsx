import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import ColorDialog from "@/components/catalog/ColorDialog";
import ColorsTable from "@/components/catalog/ColorsTable";
import ListHeader from "@/components/common/ListHeader";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export const metadata = { title: "Colours — INKHAUS Back Office" };

/**
 * Every colour. One server fetch hydrates the table, which is a client leaf
 * because its switches and dialogs write to that same cache entry.
 */
export default async function ColorsPage() {
  const user = await requireAdmin();
  const queryClient = getQueryClient();
  const colors = await queryClient.fetchQuery({
    queryKey: queryKeys.catalog.colors(),
    queryFn: () => adminApi.catalog.colors(),
  });
  const archived = colors.filter((c) => !c.active).length;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ListHeader
          title="Colours"
          meta={`${colors.length} colours · ${archived} archived`}
          actions={can(user.role, "catalog.edit") ? <ColorDialog mode="create" /> : null}
        />
        <p className="text-muted-foreground max-w-prose text-sm">
          A colour is never deleted - order lines and photos point at it. Archive it instead: it
          stays on the products that already carry it, and cannot be added to another.
        </p>
        <ColorsTable role={user.role} />
      </div>
    </HydrationBoundary>
  );
}
