"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import TierPreview, { type TierSample } from "@/components/catalog/TierPreview";
import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The ladder, read-only - what staff see in place of the editor. Same preview
 * table, same cache entry the page hydrated.
 */
export default function TierLadder({ products }: { products: TierSample[] }) {
  const t = useTranslations("Tiers");
  const { data } = useQuery({
    queryKey: queryKeys.catalog.tiers(),
    queryFn: () => clientApi.catalog.tiers(),
  });
  const tiers = (data?.tiers ?? []).map((t) => ({ min: t.minQty, off: t.discount }));

  return (
    <TierPreview
      tiers={tiers}
      products={products}
      description={t("preview.ownerHint")}
    />
  );
}
