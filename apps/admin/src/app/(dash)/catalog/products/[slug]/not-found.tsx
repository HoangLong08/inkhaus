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

export default function ProductNotFound() {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Shirt />
        </EmptyMedia>
        <EmptyTitle>Product not found</EmptyTitle>
        <EmptyDescription>
          No product has that slug. Products are archived rather than deleted, so it was never
          created under this name.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/catalog">Back to products</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
