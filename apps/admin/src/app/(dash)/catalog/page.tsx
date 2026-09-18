import { can, PRODUCT_SORTS } from "@inkhaus/shared/admin";
import { CATEGORIES } from "@inkhaus/shared/taxonomy";
import { cn } from "cn";
import { Plus, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import FilterLinks from "@/components/common/FilterLinks";
import ListEmpty from "@/components/common/ListEmpty";
import ListFooter from "@/components/common/ListFooter";
import ListHeader from "@/components/common/ListHeader";
import ListPage from "@/components/common/ListPage";
import { OrdinalCell, OrdinalHead, ordinalFrom } from "@/components/common/Ordinal";
import { ROW_LINK } from "@/components/common/row-link";
import SortableHead from "@/components/common/SortableHead";
import TableCard from "@/components/common/TableCard";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCodeLabel } from "@/i18n/labels";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count, on, usd } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, productsQuerySchema } from "@/lib/schemas/params";

export async function generateMetadata() {
  const t = await getTranslations("Catalog");
  return { title: `${t("title")} — INKHAUS Back Office` };
}

/**
 * Every blank, archived included - fully server rendered, because the table is
 * a pure projection of the URL. Only the search box is a client component, and
 * it navigates rather than fetches.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // every field ends in .catch(), so this cannot throw
  const params = productsQuerySchema.parse(await searchParams);
  const [user, { data, meta }, options, t, categoryLabel, typeLabel] = await Promise.all([
    requireAdmin(),
    adminApi.catalog.products(params),
    adminApi.lookups.catalogOptions(),
    getTranslations("Catalog"),
    getCodeLabel("Category"),
    getCodeLabel("GarmentType"),
  ]);

  // FilterLinks hands a label its value as a plain string, so each of these
  // takes `string` and falls back the way `useCodeLabel` does. `activeLabel` is
  // the one that was missing: without it FilterLinks reached for the shared
  // status table, whose keys are ACTIVE/INACTIVE, missed on "active", and
  // rendered humanize("active") - English, in every language.
  const activeLabel = (value: string) => t(`active.${value}` as "active.active");
  const sortLabel = (value: string) => t(`sort.${value}` as "sort.sort_asc");

  // the links every control builds never spell the default page size out
  const linkParams = {
    ...params,
    limit: params.limit === DEFAULT_PAGE_SIZE ? undefined : params.limit,
  };
  // a new blank carries a price, so it needs price edits open as well as the role
  const canCreate = can(user.role, "catalog.create") && options.priceEditsEnabled;
  // the same two numbers the footer counts with, so the first row's ordinal and
  // `list-range`'s "Showing 21-40" cannot disagree
  const from = ordinalFrom(meta.page, params.limit);

  return (
    <ListPage>
      <ListHeader
        title={t("title")}
        description={t("description")}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/catalog/products/new" data-testid="product-new">
                <Plus />
                {t("newProduct")}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <UrlSearchBox
              label={t("search.label")}
              placeholder={t("search.placeholder")}
              testId="products-search"
              clearTestId="products-search-clear"
            />
          </div>
          <FilterLinks
            base="/catalog"
            param="active"
            values={["active", "archived"]}
            active={params.active === "all" ? undefined : params.active}
            params={linkParams}
            ariaLabel={t("filter.status")}
            label={activeLabel}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FilterLinks
            base="/catalog"
            param="category"
            values={CATEGORIES}
            active={params.category}
            params={linkParams}
            ariaLabel={t("filter.category")}
            label={categoryLabel}
          />
          {/* what narrows the list, then how it is ordered. A gap alone did not
              read as a break - every chip is the same shape, so the eye ran
              straight from "Tech" into "Shelf order". */}
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
          <FilterLinks
            base="/catalog"
            param="sort"
            values={PRODUCT_SORTS}
            active={params.sort ?? "sort_asc"}
            params={linkParams}
            ariaLabel={t("filter.sort")}
            allLabel={null}
            label={sortLabel}
          />
        </div>
      </div>

      {data.length === 0 ? (
        <ListEmpty
          icon={SearchX}
          title={t("empty.title")}
          description={t("empty.description")}
          reason="filtered"
        />
      ) : (
        <TableCard fill>
          <Table>
            <TableHeader>
              <TableRow>
                {/* a sync component, so this `async` page may render it */}
                <OrdinalHead />
                <TableHead>{t("columns.product")}</TableHead>
                <TableHead>{t("columns.category")}</TableHead>
                <SortableHead
                  base="/catalog"
                  params={linkParams}
                  field="price"
                  label={t("columns.price")}
                  sort={params.sort}
                  first="asc"
                  align="right"
                />
                <TableHead className="text-right">{t("columns.colors")}</TableHead>
                <TableHead className="text-right">{t("columns.orders")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.edited")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((product, i) => (
                <TableRow
                  key={product.slug}
                  // the name link stretches over the whole row, so a click
                  // anywhere on it opens the product without any client JS
                  className="relative"
                  data-testid="product-row"
                  data-slug={product.slug}
                  data-active={String(product.active)}
                >
                  <OrdinalCell n={from + i} />
                  {/* name over slug · type: two lines, so it states its own py-
                      and TableCard's `py-0` steps aside for it */}
                  <TableCell className="py-1.5 leading-tight">
                    {/* a plain <a>, not a Button variant="link": the Button was
                        only ever here for the link colour, which a row link does
                        not want, and it swallowed the focus ring. */}
                    <Link
                      href={`/catalog/products/${product.slug}`}
                      data-testid="product-row-link"
                      className={cn(ROW_LINK, "font-semibold")}
                    >
                      {product.name}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      <span className="font-mono">{product.slug}</span> ·{" "}
                      {typeLabel(product.type)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {categoryLabel(product.category)}
                  </TableCell>
                  {/* price over floor - two lines again */}
                  <TableCell className="py-1.5 text-right leading-tight tabular-nums">
                    <div className="font-semibold">{usd(product.price)}</div>
                    {/* usd() first, then interpolated as a string: s9 keeps
                        money out of ICU and in lib/format.ts */}
                    <div className="text-muted-foreground text-xs">
                      {t("floor", { price: usd(product.bulkPrice) })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{product.colorCount}</TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {count(product.orderCount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.active ? "ACTIVE" : "INACTIVE"} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs">
                    {on(product.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {data.length > 0 ? (
        <ListFooter
          base="/catalog"
          page={meta.page}
          pages={meta.pages}
          limit={params.limit}
          total={meta.total}
          shown={data.length}
          noun="products"
          params={linkParams}
        />
      ) : null}
    </ListPage>
  );
}
