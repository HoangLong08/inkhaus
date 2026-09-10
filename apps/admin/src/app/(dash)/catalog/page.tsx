import { Shirt } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Products — INKHAUS Back Office" };

/** A placeholder the nav and breadcrumb can already point at; the catalog workstream replaces it. */
export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <ListHeader title="Products" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Shirt />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              Every blank the storefront sells - its copy, sizes, colours and print area - will be
              edited here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
