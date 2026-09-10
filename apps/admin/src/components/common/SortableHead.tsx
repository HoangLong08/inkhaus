import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { TableHead } from "@/components/ui/table";
import { hrefWith, type Params } from "@/lib/url";

type Props = {
  base: string;
  /** the page's zod-parsed params; kept, except `page`, which is dropped */
  params?: Params;
  /** the column's sort key: `total` sorts as `total_asc` / `total_desc` */
  field: string;
  label: string;
  /** the list's current sort value, `<field>_<asc|desc>` */
  sort?: string;
  param?: string;
  /** direction on the first click - money and dates want desc, names asc */
  first?: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
};

/**
 * A column header that sorts by being a link, so the sort is in the URL like
 * every other list control: shareable, back-button safe, server-rendered.
 * Clicking the active column flips it; clicking another starts at `first`.
 *
 * `aria-sort` goes on the `<th>`, which is where assistive tech reads it; the
 * link inside carries the test hooks (`sort-head`, `data-sort`, `data-active`).
 */
export default function SortableHead({
  base,
  params = {},
  field,
  label,
  sort,
  param = "sort",
  first = "desc",
  align = "left",
  className,
}: Props) {
  const direction = sort === `${field}_asc` ? "asc" : sort === `${field}_desc` ? "desc" : null;
  const next = direction === null ? first : direction === "desc" ? "asc" : "desc";
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <TableHead
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <Link
        href={hrefWith(base, params, { [param]: `${field}_${next}` })}
        data-testid="sort-head"
        data-sort={field}
        data-active={direction ? "true" : "false"}
        data-direction={direction ?? undefined}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("size-4", !direction && "text-muted-foreground")} />
        <span className="sr-only">, sort {next === "asc" ? "ascending" : "descending"}</span>
      </Link>
    </TableHead>
  );
}
