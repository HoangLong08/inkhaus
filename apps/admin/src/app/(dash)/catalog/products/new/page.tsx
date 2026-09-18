import { can } from "@inkhaus/shared/admin";
import { ArrowLeft } from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Link from "next/link";

import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import ProductForm from "@/components/catalog/ProductForm";
import OwnersOnly from "@/components/common/OwnersOnly";
import { Button } from "@/components/ui/button";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import { pageMessages } from "@/i18n/messages";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata() {
  const t = await getTranslations("Product");
  return { title: `${t("new.title")} — INKHAUS Back Office` };
}

/**
 * A new blank. Owners only (D12) - it carries a price - and only while price
 * edits are on (D13); otherwise the page says why instead of offering a form
 * whose save would be refused.
 */
export default async function NewProductPage() {
  const [user, t, locale, messages] = await Promise.all([
    requireAdmin(),
    getTranslations("Product"),
    getLocale(),
    getMessages(),
  ]);
  if (!can(user.role, "catalog.create")) {
    return <OwnersOnly title={t("new.title")}>{t("new.ownersOnly")}</OwnersOnly>;
  }

  const [options, sizes, colors] = await Promise.all([
    adminApi.lookups.catalogOptions(),
    adminApi.catalog.sizes(),
    adminApi.catalog.colors(),
  ]);

  return (
    // ProductForm and PriceSyncWarning are client leaves, and the form's own
    // selects read the two taxonomy code tables
    <IntlClientProvider
      locale={locale}
      messages={pageMessages(messages, "Product", "PriceSync", "GarmentType", "Category")}
    >
      <div className="space-y-6">
        <div>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/catalog" data-testid="product-back">
              <ArrowLeft />
              {t("back")}
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("new.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("new.description")}</p>
        </div>

        {options.priceEditsEnabled ? (
          <ProductForm
            mode="create"
            role={user.role}
            priceEditsEnabled={options.priceEditsEnabled}
            sizes={sizes}
            colors={colors}
          />
        ) : (
          <PriceSyncWarning />
        )}
      </div>
    </IntlClientProvider>
  );
}
