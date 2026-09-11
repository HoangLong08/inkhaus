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

export default function PackingSlipNotFound() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Packing slip not found</h1>
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageX />
            </EmptyMedia>
            <EmptyTitle>No order with that number</EmptyTitle>
            <EmptyDescription>There is nothing to pack for an order that does not exist.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/orders" data-testid="packing-slip-not-found-back">
                Back to orders
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </div>
  );
}
