import { can, PRODUCT_SORTS, type ProductSort } from "@inkhaus/shared/admin";
import { CATEGORIES, CATEGORY_LABEL, GARMENT_TYPE_LABEL } from "@inkhaus/shared/taxonomy";
import { cn } from "cn";
import { Plus, SearchX } from "lucide-react";
import Link from "next/link";

import FilterLinks from "@/components/common/FilterLinks";
import ListEmpty from "@/components/common/ListEmpty";
import ListHeader from "@/components/common/ListHeader";
import PageSizeLinks from "@/components/common/PageSizeLinks";
import { ROW_LINK } from "@/components/common/row-link";
import SortableHead from "@/components/common/SortableHead";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import Pager from "@/components/Pager";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count, humanize, on, usd } from "@/lib/format";
import { catalogCategorySchema } from "@/lib/schemas/api";
import {
  DEFAULT_PAGE_SIZE,
  productSortParamSchema,
  productsQuerySchema,
} from "@/lib/schemas/params";

export const metadata = { title: "Products — INKHAUS Back Office" };

const SORT_LABEL: Record<ProductSort, string> = {
  sort_asc: "Shelf order",
  name_asc: "Name",
  price_asc: "Price, low first",
  price_desc: "Price, high first",
  updated_desc: "Recently edited",
};

// FilterLinks hands a label its value as a plain string: checked, not cast
function categoryLabel(value: string) {
  const parsed = catalogCategorySchema.safeParse(value);
  return parsed.success ? CATEGORY_LABEL[parsed.data] : humanize(value);
}

function sortLabel(value: string) {
  const parsed = productSortParamSchema.safeParse(value);
  return parsed.success ? SORT_LABEL[parsed.data] : humanize(value);
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
  const [user, { data, meta }, options] = await Promise.all([
    requireAdmin(),
    adminApi.catalog.products(params),
    adminApi.lookups.catalogOptions(),
  ]);

  // the links every control builds never spell the default page size out
  const linkParams = {
    ...params,
    limit: params.limit === DEFAULT_PAGE_SIZE ? undefined : params.limit,
  };
  // a new blank carries a price, so it needs price edits open as well as the role
  const canCreate = can(user.role, "catalog.create") && options.priceEditsEnabled;

  return (
    <div className="space-y-6">
      <ListHeader
        title="Products"
        meta={`${count(meta.total)} products · page ${meta.page} of ${meta.pages}`}
        metaTestId="products-meta"
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/catalog/products/new" data-testid="product-new">
                <Plus />
                New product
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-3">
        <UrlSearchBox
          label="Search products"
          placeholder="Name or slug"
          testId="products-search"
          clearTestId="products-search-clear"
        />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <FilterLinks
            base="/catalog"
            param="active"
            values={["active", "archived"]}
            active={params.active === "all" ? undefined : params.active}
            params={linkParams}
            ariaLabel="Filter by status"
          />
          <FilterLinks
            base="/catalog"
            param="category"
            values={CATEGORIES}
            active={params.category}
            params={linkParams}
            ariaLabel="Filter by category"
            label={categoryLabel}
          />
        </div>
        <FilterLinks
          base="/catalog"
          param="sort"
          values={PRODUCT_SORTS}
          active={params.sort ?? "sort_asc"}
          params={linkParams}
          ariaLabel="Sort products"
          allLabel={null}
          label={sortLabel}
        />
      </div>

      {data.length === 0 ? (
        <ListEmpty
          icon={SearchX}
          title="No products match"
          description="Try another category or status, or clear the search."
          reason="filtered"
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <SortableHead
                  base="/catalog"
                  params={linkParams}
                  field="price"
                  label="Price"
                  sort={params.sort}
                  first="asc"
                  align="right"
                />
                <TableHead className="text-right">Colours</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((product) => (
                <TableRow
                  key={product.slug}
                  // the name link stretches over the whole row, so a click
                  // anywhere on it opens the product without any client JS
                  className="relative"
                  data-testid="product-row"
                  data-slug={product.slug}
                  data-active={String(product.active)}
                >
                  <TableCell>
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
                      {GARMENT_TYPE_LABEL[product.type]}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CATEGORY_LABEL[product.category]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="font-semibold">{usd(product.price)}</div>
                    <div className="text-muted-foreground text-xs">floor {usd(product.bulkPrice)}</div>
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
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageSizeLinks base="/catalog" params={linkParams} active={params.limit} />
        <Pager base="/catalog" page={meta.page} pages={meta.pages} params={linkParams} />
      </div>
    </div>
  );
}
