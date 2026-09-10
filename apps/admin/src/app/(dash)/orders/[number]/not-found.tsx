import { PackageX } from "lucide-react";
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

export default function OrderNotFound() {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageX />
        </EmptyMedia>
        <EmptyTitle>Order not found</EmptyTitle>
        <EmptyDescription>
          No order with that number. It may have been a typo, or the order was never placed.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/orders">Back to orders</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
