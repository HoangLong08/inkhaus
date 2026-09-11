import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import SizeDialog from "@/components/catalog/SizeDialog";
import SizesTable from "@/components/catalog/SizesTable";
import ListHeader from "@/components/common/ListHeader";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export const metadata = { title: "Sizes — INKHAUS Back Office" };

/**
 * Every size code and its upcharge. A new code carries an upcharge, so adding
 * one is an owner's price decision and waits for price edits to be on.
 */
export default async function SizesPage() {
  const user = await requireAdmin();
  const queryClient = getQueryClient();
  const [sizes, options] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.catalog.sizes(),
      queryFn: () => adminApi.catalog.sizes(),
    }),
    adminApi.lookups.catalogOptions(),
  ]);
  const canPrice = can(user.role, "catalog.price");

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ListHeader
          title="Sizes"
          meta={`${sizes.length} sizes`}
          actions={
            canPrice && options.priceEditsEnabled ? (
              <SizeDialog mode="create" canPrice={canPrice} priceEditsEnabled={options.priceEditsEnabled} />
            ) : null
          }
        />
        <p className="text-muted-foreground max-w-prose text-sm">
          A product with no size run of its own is sold in the default run, XS to 3XL. Those codes,
          and any code a product stocks, cannot be deleted; past orders keep their sizes either way.
        </p>
        {!options.priceEditsEnabled ? <PriceSyncWarning /> : null}
        <SizesTable role={user.role} priceEditsEnabled={options.priceEditsEnabled} />
      </div>
    </HydrationBoundary>
  );
}
