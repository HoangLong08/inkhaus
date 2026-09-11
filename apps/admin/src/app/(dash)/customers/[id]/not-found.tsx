import { UserX } from "lucide-react";
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

export default function CustomerNotFound() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Customer not found</h1>
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserX />
          </EmptyMedia>
          <EmptyTitle>No customer at this address</EmptyTitle>
          <EmptyDescription>
            The link may be out of date. Search the customer list by email or name instead.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/customers">Back to customers</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
