import { Check, Settings2 } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { TOOLBAR_BUTTON } from "@/components/common/toolbar-styles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ORDER_COLUMNS, type OrderColumn } from "@/lib/schemas/params";
import { hrefWith, type Params } from "@/lib/url";

const LABELS: Record<OrderColumn, string> = {
  status: "Status",
  customer: "Customer",
  units: "Units",
  total: "Total",
  placed: "Placed",
};

/**
 * Which columns the orders table draws, held in `?cols=` like every other list
 * control. Each entry is a real link, so the choice is shareable, survives the
 * back button, renders on the server and needs no client state - the same reason
 * the filters and the sort are links.
 *
 * Two shadcn notes, both load-bearing:
 *
 * - This is `DropdownMenuItem asChild`, **not** `DropdownMenuCheckboxItem
 *   asChild`. The checkbox item renders its indicator `<span>` *and* `children`
 *   into the primitive with no `<Slottable>`, so Radix's Slot sees two children
 *   and throws. The checkmark is drawn here instead.
 * - Radix writes `role="menuitem"` **before** spreading our props, so the
 *   `role`/`aria-checked` below win and the control announces itself correctly.
 *
 * The menu closes on choosing, which is right: the link is a navigation, and the
 * ticks come back from the URL the page re-renders with.
 */
export default function OrdersColumnsMenu({
  cols,
  sort,
  page,
  linkParams,
}: {
  /** the visible columns, parsed */
  cols: readonly OrderColumn[];
  /** the list's sort value; its column cannot be hidden */
  sort: string;
  /** kept, unlike every other control here: hiding a column is not a new result set */
  page: number;
  linkParams: Params;
}) {
  const sorted = sort.replace(/_(asc|desc)$/, "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={TOOLBAR_BUTTON} data-testid="orders-columns">
          <Settings2 />
          Columns
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[0.6875rem]">Columns shown</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {ORDER_COLUMNS.map((column) => {
          const visible = cols.includes(column);
          // You cannot hide what the list is sorted by - the rows would be
          // ordered by something with no header left to flip - and you cannot
          // hide the last one standing, which would read as an empty table.
          const locked = visible && (column === sorted || cols.length === 1);

          if (locked) {
            return (
              <DropdownMenuItem
                key={column}
                disabled
                role="menuitemcheckbox"
                aria-checked
                className="text-xs"
                data-testid="orders-column"
                data-column={column}
                data-visible="true"
              >
                <Check className="size-4" aria-hidden />
                {LABELS[column]}
              </DropdownMenuItem>
            );
          }

          const next = new Set(cols);
          if (visible) next.delete(column);
          else next.add(column);
          const kept = ORDER_COLUMNS.filter((name) => next.has(name));

          return (
            <DropdownMenuItem
              key={column}
              asChild
              role="menuitemcheckbox"
              aria-checked={visible}
              className="text-xs"
              data-testid="orders-column"
              data-column={column}
              data-visible={visible}
            >
              <Link
                href={hrefWith("/orders", linkParams, {
                  cols: kept.length === ORDER_COLUMNS.length ? undefined : kept.join(","),
                  page,
                })}
                scroll={false}
              >
                <Check className={cn("size-4", !visible && "invisible")} aria-hidden />
                {LABELS[column]}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
