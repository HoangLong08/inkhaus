import { cn } from "cn";

import { Card } from "@/components/ui/card";

/**
 * The bordered block a list page's table lives in: an optional toolbar strip and
 * the table, inside one `Card` border. The pager is deliberately **not** in here -
 * it sits under the border as its own row, which is where the design this follows
 * puts it.
 *
 * ---
 *
 * **This is also where the table's density lives, and it is deliberately not in
 * `ui/table.tsx`.** That file is generated: `shadcn add table --overwrite` rewrites
 * it verbatim, and it has 19 importers - the print packing slip, the overview's
 * series table, the tier editor, every other list. Editing its `th { h-10 px-2 }`
 * and `td { p-2 }` would restyle all of them at once and could not be scoped to one
 * page, so the density is pushed down from here instead.
 *
 * The descendant variants below beat the primitive's own utilities by specificity,
 * not by luck. Tailwind v4 compiles `[&_tbody_td]:px-3` to `.class tbody td { … }` -
 * one class plus two type selectors, (0,1,2) - with no `:where()` wrapper, and emits
 * it into the same `@layer utilities` as `.p-2` (0,1,0). Same layer means plain
 * specificity decides, so source order cannot flip it on the next build. `px-3` and
 * `py-0` set `padding-inline` and `padding-block`, which outrank the shorthand
 * `padding` from `p-2` on every side.
 *
 * `thead`/`tbody` are in those selectors on purpose rather than a bare `[&_th]`:
 * `TableRow` carries `hover:bg-muted/50` at (0,2,0), so killing the header row's
 * hover needs the extra type selector to reach (0,2,1) and win.
 *
 * The one cost: a per-cell padding override at the call site (`<TableCell
 * className="py-6">`, (0,1,0)) now loses silently. No list needs one today. When one
 * does, the escape hatch is shadcn's own idiom - `[&_tbody_td:not([class*='py-'])]`.
 */
const DENSITY = [
  // 12px throughout. A back-office table is scanned, not read.
  "[&_table]:text-xs",
  // header: 36px, tinted, ruled between columns
  "[&_thead_th]:h-9 [&_thead_th]:px-3 [&_thead_th]:py-0 [&_thead_th]:bg-secondary/90",
  "[&_thead_th]:border-r [&_thead_th:last-child]:border-r-0",
  // the tint is the header's own; without this the row hover paints over it
  "[&_thead_tr]:hover:bg-transparent",
  // body: 36px rows, 12px gutters, ruled both ways like a spreadsheet
  "[&_tbody_tr]:h-9",
  "[&_tbody_td]:px-3 [&_tbody_td]:py-0",
  "[&_tbody_td]:border-r [&_tbody_td:last-child]:border-r-0",
  // Zebra, stepped aside for hover and selection. `TableRow` carries
  // `hover:bg-muted/50` and `data-[state=selected]:bg-muted` at (0,2,0); any
  // descendant selector here outranks both, so instead of fighting them the
  // stripe simply stops matching while a row is hovered or ticked.
  "[&_tbody_tr:nth-child(even):not(:hover):not([data-state=selected])]:bg-muted/30",
].join(" ");

export default function TableCard({
  children,
  toolbar,
  className,
}: {
  /** the `<Table>` itself */
  children: React.ReactNode;
  /** a strip above the table but inside the border - reviews' bulk actions */
  toolbar?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(DENSITY, "gap-0 overflow-hidden rounded-md p-0 shadow-none", className)}>
      {toolbar}
      {children}
    </Card>
  );
}
