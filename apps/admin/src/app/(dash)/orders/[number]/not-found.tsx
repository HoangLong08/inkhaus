import { PackageX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** its own h1, like every page - EmptyTitle is a div, not a heading */
export default function OrderNotFound() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Order not found</h1>
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageX />
            </EmptyMedia>
            <EmptyTitle>No order with that number</EmptyTitle>
            <EmptyDescription>
              It may have been a typo, or the order was never placed.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/orders" data-testid="order-not-found-back">
                Back to orders
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </div>
  );
}
