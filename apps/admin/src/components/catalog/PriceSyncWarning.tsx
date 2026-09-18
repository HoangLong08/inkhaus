import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Why the price fields are locked while CATALOG_PRICE_EDITS is off (D13).
 * Shown to everyone on every screen with a price on it, so nobody reads a
 * disabled input as a bug.
 *
 * No "use client": three of its four call sites are Server Components, where
 * `useTranslations` reads the whole catalogue. The fourth is ProductForm, which
 * IS a client component - so the product page has to carry `PriceSync` in its
 * own provider alongside its own namespace.
 */
export default function PriceSyncWarning() {
  const t = useTranslations("PriceSync");

  return (
    <Alert data-testid="price-sync-warning">
      <TriangleAlert />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <p>{t("description")}</p>
      </AlertDescription>
    </Alert>
  );
}
