import { PackageOpen, SearchX } from "lucide-react";
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

export type OrdersEmptyReason = "none" | "filtered" | "page";

const COPY: Record<OrdersEmptyReason, { title: string; description: string; action?: string }> = {
  none: {
    title: "No orders yet",
    description: "Orders appear here the moment a customer checks out.",
  },
  filtered: {
    title: "No orders match",
    description: "Nothing fits this search, status and date range together.",
    action: "Clear filters",
  },
  page: {
    title: "Nothing on this page",
    description: "The list is shorter than that now.",
    action: "Go to the last page",
  },
};

/**
 * Why the table is empty, which is three different answers: the shop has no
 * orders, the filters exclude everything, or the URL asks for a page past the
 * end - an old link, or a list that shrank. Each gets its own words and, where
 * there is one, the way out. `data-reason` says which, for tests.
 */
export default function OrdersEmpty({
  reason,
  actionHref,
}: {
  reason: OrdersEmptyReason;
  /** where the action leads: the list without filters, or its last page */
  actionHref?: string;
}) {
  const copy = COPY[reason];
  const Icon = reason === "none" ? PackageOpen : SearchX;

  return (
    <Card>
      <Empty className="py-10" data-testid="orders-empty" data-reason={reason}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{copy.title}</EmptyTitle>
          <EmptyDescription>{copy.description}</EmptyDescription>
        </EmptyHeader>
        {copy.action && actionHref ? (
          <EmptyContent>
            <Button asChild variant="outline" size="sm">
              <Link href={actionHref} data-testid="orders-empty-action">
                {copy.action}
              </Link>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    </Card>
  );
}
