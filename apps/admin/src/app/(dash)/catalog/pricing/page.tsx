import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import TierEditor from "@/components/catalog/TierEditor";
import TierLadder from "@/components/catalog/TierLadder";
import ListHeader from "@/components/common/ListHeader";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export const metadata = { title: "Price tiers — INKHAUS Back Office" };

/**
 * How many blanks the preview can price: one page of the products list, whose
 * ceiling in the API is 100. The page says so when there are more on sale,
 * rather than leaving the rest out without a word.
 */
const PREVIEW_PRODUCTS = 100;

/**
 * The volume discount ladder every order is priced on. Owners edit it (while
 * price edits are on); staff get the same preview, read-only.
 */
export default async function PricingPage() {
  const user = await requireAdmin();
  const queryClient = getQueryClient();
  const [tiers, options, products] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.catalog.tiers(),
      queryFn: () => adminApi.catalog.tiers(),
    }),
    adminApi.lookups.catalogOptions(),
    // the preview prices a real blank; those on sale, in shelf order
    adminApi.catalog.products({ active: "active", limit: PREVIEW_PRODUCTS }),
  ]);
  const samples = products.data.map(({ slug, name, price, bulkPrice }) => ({
    slug,
    name,
    price,
    bulkPrice,
  }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ListHeader title="Price tiers" meta={`${tiers.tiers.length} tiers`} />
        <p className="text-muted-foreground max-w-prose text-sm">
          An order is priced on its total quantity: the deepest tier it reaches sets the discount
          off each product&apos;s single-unit price, and no unit ever costs less than that
          product&apos;s bulk price. Size upcharges are added on top.
        </p>
        {products.meta.total > samples.length ? (
          <p className="text-muted-foreground max-w-prose text-sm">
            The preview offers the first {count(samples.length)} of {count(products.meta.total)}{" "}
            products on sale, in shelf order.
          </p>
        ) : null}
        {!options.priceEditsEnabled ? <PriceSyncWarning /> : null}
        {can(user.role, "catalog.price") ? (
          <TierEditor priceEditsEnabled={options.priceEditsEnabled} products={samples} />
        ) : (
          <TierLadder products={samples} />
        )}
      </div>
    </HydrationBoundary>
  );
}
