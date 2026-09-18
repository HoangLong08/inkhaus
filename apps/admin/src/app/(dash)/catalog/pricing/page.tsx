import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import TierEditor from "@/components/catalog/TierEditor";
import TierLadder from "@/components/catalog/TierLadder";
import ListHeader from "@/components/common/ListHeader";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import { pageMessages } from "@/i18n/messages";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export async function generateMetadata() {
  const t = await getTranslations("Tiers");
  return { title: `${t("title")} — INKHAUS Back Office` };
}

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
  const [user, t, locale, messages] = await Promise.all([
    requireAdmin(),
    getTranslations("Tiers"),
    getLocale(),
    getMessages(),
  ]);
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
    // TierEditor, TierPreview and PriceSyncWarning are client leaves here
    <IntlClientProvider locale={locale} messages={pageMessages(messages, "Tiers", "PriceSync")}>
      <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ListHeader
          title={t("title")}
          meta={t("meta", {
            count: tiers.tiers.length,
            total: count(tiers.tiers.length),
          })}
        />
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
        {products.meta.total > samples.length ? (
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("capped", {
              shown: count(samples.length),
              total: count(products.meta.total),
            })}
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
    </IntlClientProvider>
  );
}
