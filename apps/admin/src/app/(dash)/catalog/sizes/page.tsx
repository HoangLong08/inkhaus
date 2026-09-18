import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import SizeDialog from "@/components/catalog/SizeDialog";
import SizesTable from "@/components/catalog/SizesTable";
import ListHeader from "@/components/common/ListHeader";
import ListPage from "@/components/common/ListPage";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import { pageMessages } from "@/i18n/messages";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export async function generateMetadata() {
  const t = await getTranslations("Sizes");
  return { title: `${t("title")} — INKHAUS Back Office` };
}

/**
 * Every size code and its upcharge. A new code carries an upcharge, so adding
 * one is an owner's price decision and waits for price edits to be on.
 */
export default async function SizesPage() {
  const [user, t, locale, messages] = await Promise.all([
    requireAdmin(),
    getTranslations("Sizes"),
    getLocale(),
    getMessages(),
  ]);
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
    // SizesTable, SizeDialog and PriceSyncWarning are client leaves here
    <IntlClientProvider locale={locale} messages={pageMessages(messages, "Sizes", "PriceSync")}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ListPage>
          <ListHeader
            title={t("title")}
            description={t("description")}
            meta={t("meta", { count: sizes.length, total: count(sizes.length) })}
            actions={
              canPrice && options.priceEditsEnabled ? (
                <SizeDialog
                  mode="create"
                  canPrice={canPrice}
                  priceEditsEnabled={options.priceEditsEnabled}
                />
              ) : null
            }
          />
          {!options.priceEditsEnabled ? <PriceSyncWarning /> : null}
          <SizesTable role={user.role} priceEditsEnabled={options.priceEditsEnabled} />
        </ListPage>
      </HydrationBoundary>
    </IntlClientProvider>
  );
}
