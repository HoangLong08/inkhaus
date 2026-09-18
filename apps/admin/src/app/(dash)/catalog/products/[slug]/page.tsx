import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProductForm from "@/components/catalog/ProductForm";
import ProductHistory from "@/components/catalog/ProductHistory";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import { pageMessages } from "@/i18n/messages";
import { adminApi, ApiError, type CatalogProduct } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { at, count } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { productSlugParamSchema } from "@/lib/schemas/params";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug} — INKHAUS Back Office` };
}

/**
 * One blank. The form is the only client leaf: it reads the product from the
 * cache this page hydrates. The heading, the history card and the photo list
 * are server rendered, and a save refreshes them with `router.refresh()`.
 */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug: raw }, user, t, locale, messages] = await Promise.all([
    params,
    requireAdmin(),
    getTranslations("Product"),
    getLocale(),
    getMessages(),
  ]);

  // a segment no slug could be never reaches the API
  const parsed = productSlugParamSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const slug = parsed.data;

  const queryClient = getQueryClient();

  const [product, options, sizes, colors] = await Promise.all([
    // fetchQuery, not prefetchQuery: the server half of the page needs it too
    queryClient
      .fetchQuery({
        queryKey: queryKeys.catalog.product(slug),
        queryFn: () => adminApi.catalog.product(slug),
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) notFound();
        throw err;
      }),
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
      <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/catalog" data-testid="product-back">
              <ArrowLeft />
              {t("back")}
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <StatusBadge status={product.active ? "ACTIVE" : "INACTIVE"} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="font-mono">{product.slug}</span> ·{" "}
            {t("meta", {
              count: product.orderCount,
              orders: count(product.orderCount),
              edited: at(product.updatedAt),
            })}
          </p>
        </div>

        <ProductForm
          mode="edit"
          slug={product.slug}
          role={user.role}
          priceEditsEnabled={options.priceEditsEnabled}
          sizes={sizes}
          colors={colors}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ProductHistory entries={product.history} />
          <Photos images={product.images} />
        </div>
      </div>
      </HydrationBoundary>
    </IntlClientProvider>
  );
}

/** read-only: photography is managed in the storefront's repository (D15) */
function Photos({ images }: { images: CatalogProduct["images"] }) {
  const t = useTranslations("Product");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {t("photos.title")}
        </CardTitle>
        <CardDescription>{t("photos.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("photos.empty")}
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {images.map((image) => (
              <li key={image.src}>
                <span className="font-mono text-xs break-all">{image.src}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {t("photos.dimensions", { width: String(image.width), height: String(image.height) })}
                  {image.color ? ` · ${image.color}` : ` · ${t("photos.everyColour")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
