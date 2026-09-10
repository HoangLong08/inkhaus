import Link from "next/link";

import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format";

/**
 * The status chip row, shared by /orders and /quotes - it was copied between
 * them before, as `FilterChip` and `Chip`.
 *
 * These stay links on purpose. Tabs and ToggleGroup are both client-only and
 * hold their selection in React state, which would cost this row three things
 * it currently has for free: the deep link (`/orders?status=PAID` is how the
 * overview tiles navigate), `aria-current="page"`, and being server-rendered at
 * all. A filter belongs in the URL.
 *
 * `Button asChild` works in a Server Component because Radix's Slot carries no
 * "use client".
 */
export default function StatusFilterLinks({
  base,
  statuses,
  active,
}: {
  base: string;
  statuses: readonly string[];
  active?: string;
}) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
      {[undefined, ...statuses].map((status) => {
        const isActive = status === active;
        return (
          <Button
            key={status ?? "ALL"}
            asChild
            size="sm"
            variant={isActive ? "default" : "outline"}
            className="h-7 rounded-full px-3 text-xs font-semibold"
          >
            <Link
              href={status ? `${base}?status=${status}` : base}
              aria-current={isActive ? "page" : undefined}
              data-testid="status-filter"
              data-status={status ?? "ALL"}
            >
              {status ? humanize(status) : "All"}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
