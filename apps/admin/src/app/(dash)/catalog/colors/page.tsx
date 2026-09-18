import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import ColorDialog from "@/components/catalog/ColorDialog";
import ColorsTable from "@/components/catalog/ColorsTable";
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
  const t = await getTranslations("Colors");
  return { title: `${t("title")} — INKHAUS Back Office` };
}

/**
 * Every colour. One server fetch hydrates the table, which is a client leaf
 * because its switches and dialogs write to that same cache entry.
 */
export default async function ColorsPage() {
  const [user, t, locale, messages] = await Promise.all([
    requireAdmin(),
    getTranslations("Colors"),
    getLocale(),
    getMessages(),
  ]);
  const queryClient = getQueryClient();
  const colors = await queryClient.fetchQuery({
    queryKey: queryKeys.catalog.colors(),
    queryFn: () => adminApi.catalog.colors(),
  });
  const archived = colors.filter((c) => !c.active).length;

  return (
    // ColorsTable and ColorDialog are client leaves that read `Colors`, and the
    // layout's provider carries the chrome only. `pageMessages` adds this
    // namespace to it rather than replacing it - nested providers do not merge.
    <IntlClientProvider locale={locale} messages={pageMessages(messages, "Colors")}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ListPage>
          <ListHeader
            title={t("title")}
            description={t("description")}
            // the raw counts feed the plural, the formatted ones feed the words
            meta={t("meta", {
              count: colors.length,
              total: count(colors.length),
              archived: count(archived),
            })}
            actions={can(user.role, "catalog.edit") ? <ColorDialog mode="create" /> : null}
          />
          <ColorsTable role={user.role} />
        </ListPage>
      </HydrationBoundary>
    </IntlClientProvider>
  );
}
