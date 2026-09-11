import { Shirt } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** its own h1, like every page - EmptyTitle is a div, not a heading */
export default function ProductNotFound() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Product not found</h1>
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Shirt />
          </EmptyMedia>
          <EmptyTitle>No product has that slug</EmptyTitle>
          <EmptyDescription>
            Products are archived rather than deleted, so it was never created under this name.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/catalog" data-testid="product-not-found-back">
              Back to products
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
