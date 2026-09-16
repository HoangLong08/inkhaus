import { PackageOpen, SearchX } from "lucide-react";

import ListEmpty from "@/components/common/ListEmpty";

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
 *
 * The block itself is the shared `ListEmpty`; what is left here is the copy.
 * The ids stay `orders-empty` / `orders-empty-action` rather than defaulting to
 * `list-empty`, because `e2e/orders.spec.ts` asserts both by name.
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

  return (
    <ListEmpty
      icon={reason === "none" ? PackageOpen : SearchX}
      title={copy.title}
      description={copy.description}
      action={copy.action}
      actionHref={actionHref}
      actionTestId="orders-empty-action"
      reason={reason}
      testId="orders-empty"
    />
  );
}
