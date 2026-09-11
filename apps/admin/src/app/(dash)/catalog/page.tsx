import { can, PRODUCT_SORTS, type ProductSort } from "@inkhaus/shared/admin";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  GARMENT_TYPE_LABEL,
  type ProductCategory,
} from "@inkhaus/shared/taxonomy";
import { Plus, SearchX } from "lucide-react";
import Link from "next/link";

import FilterLinks from "@/components/common/FilterLinks";
import ListHeader from "@/components/common/ListHeader";
import PageSizeLinks from "@/components/common/PageSizeLinks";
import SortableHead from "@/components/common/SortableHead";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import Pager from "@/components/Pager";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { count, on, usd } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, productsQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Products — INKHAUS Back Office" };

const SORT_LABEL: Record<ProductSort, string> = {
  sort_asc: "Shelf order",
  name_asc: "Name",
  price_asc: "Price, low first",
  price_desc: "Price, high first",
  updated_desc: "Recently edited",
};

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
            label={(value) => CATEGORY_LABEL[value as ProductCategory]}
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
          label={(value) => SORT_LABEL[value as ProductSort]}
        />
      </div>

      {data.length === 0 ? (
        <Card>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No products match</EmptyTitle>
              <EmptyDescription>Try another category or status, or clear the search.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
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
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="h-auto p-0 font-semibold after:absolute after:inset-0"
                    >
                      <Link href={`/catalog/products/${product.slug}`}>{product.name}</Link>
                    </Button>
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
