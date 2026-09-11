import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { count, usd } from "@/lib/format";
import type { OverviewQuery } from "@/lib/schemas/params";

import { getOverview } from "./data";

/** the five best sellers of the range, each a link to its catalog page */
export default async function TopProducts({ params }: { params: OverviewQuery }) {
  const { topProducts } = await getOverview(params);
  if (!topProducts) return null;

  return (
    <Card className="gap-0 overflow-hidden pb-0">
      <CardHeader className="border-b">
        <CardTitle>
          <h3>Top products</h3>
        </CardTitle>
        <CardDescription>
          By line revenue on paid orders - before shipping, tax and discounts.
        </CardDescription>
      </CardHeader>

      {topProducts.length === 0 ? (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBag />
            </EmptyMedia>
            <EmptyTitle>Nothing sold in this range</EmptyTitle>
            <EmptyDescription>Products appear here once a paid order includes them.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Product</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="pr-6 text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProducts.map((product) => (
              <TableRow key={product.slug}>
                <TableCell className="max-w-56 truncate pl-6">
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link
                      href={`/catalog/products/${product.slug}`}
                      data-testid="top-product"
                      data-slug={product.slug}
                    >
                      {product.name}
                    </Link>
                  </Button>
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {count(product.units)}
                </TableCell>
                <TableCell className="pr-6 text-right font-semibold tabular-nums">
                  {usd(product.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
