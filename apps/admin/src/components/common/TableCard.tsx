import { cn } from "cn";

import { Card } from "@/components/ui/card";

/**
 * The bordered block a list page's table lives in: an optional toolbar strip and
 * the table, inside one `Card` border. The pager is deliberately **not** in here -
 * it sits under the border as its own row, which is where the design this follows
 * puts it. (`footer` below is for a summary rail that genuinely belongs inside
 * the border, like a customer profile's "N of M shown" line, not for a pager.)
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
  // The escape hatch the docblock used to only promise. Four lists carry a
  // primary line over a `text-muted-foreground text-xs` subline, and `py-0`
  // butts both against the cell edge. `:not([class*='py-'])` is shadcn's own
  // idiom: the variant simply stops matching a cell that states its own vertical
  // padding, so a call-site `py-1.5` (0,1,0) applies instead of losing silently
  // to (0,1,2). A cell that says nothing still gets `py-0` and a 36px row.
  "[&_tbody_td]:px-3 [&_tbody_td:not([class*='py-'])]:py-0",
  "[&_tbody_td]:border-r [&_tbody_td:last-child]:border-r-0",
  // Zebra, stepped aside for hover and selection. `TableRow` carries
  // `hover:bg-muted/50` and `data-[state=selected]:bg-muted` at (0,2,0); any
  // descendant selector here outranks both, so instead of fighting them the
  // stripe simply stops matching while a row is hovered or ticked.
  "[&_tbody_tr:nth-child(even):not(:hover):not([data-state=selected])]:bg-muted/30",
].join(" ");

/**
 * What the card does when the page owns the viewport - see `ListPage`. The card
 * becomes the one flexible row of that column, and the one box inside it that
 * may scroll is the primitive's own container div.
 *
 * That div lives in `ui/table.tsx`, which is generated and takes no
 * `containerClassName` on this version, so it is reached the same way the density
 * is: from out here, by selector. `[&>[data-slot=table-container]]:overflow-auto`
 * compiles to `.class > [data-slot=table-container] { overflow: auto }` - one
 * class plus one attribute selector, (0,2,0) - into the same `@layer utilities`
 * as the primitive's own `.overflow-x-auto` (0,1,0), so the shorthand wins on
 * both axes and no build order can flip it.
 *
 * Strictly the `overflow-auto` is belt and braces: per CSS Overflow 3 §3.3, when
 * one axis computes to something other than `visible` the other computes to
 * `auto`, so `overflow-x-auto` alone already makes that div the nearest
 * scrollport for a sticky `<thead>`. What it has never had is a height.
 *
 * `>` and not `_`: `children` **is** the `<Table>`, so the container is always a
 * direct child, and a descendant selector would also catch a table nested inside
 * a cell.
 *
 * `min-h-0` on both the card and the container is the whole trick. A column flex
 * item's automatic minimum is its min-content height, so without it a 100-row
 * table refuses to shrink and pushes the footer off the bottom of the screen
 * instead of scrolling.
 *
 * `overflow-hidden` stays on the card and does **not** break the sticky header:
 * sticky resolves against the nearest scroll container, which is the container
 * div, and the header never leaves it. What the clip does do is keep the table's
 * square corners inside the card's radius - including shaving the ends off the
 * 14px horizontal scrollbar, which is the intended look.
 */
const FILL = [
  "min-h-0 flex-1",
  "[&>[data-slot=table-container]]:min-h-0",
  "[&>[data-slot=table-container]]:flex-1",
  "[&>[data-slot=table-container]]:overflow-auto",
].join(" ");

/**
 * The header stays put while the rows move under it.
 *
 * Everything here is on the `<th>`, not on the `<thead>`, and both halves of
 * that matter.
 *
 * `position: sticky` on a `table-header-group` only works in fairly recent
 * engines; on the cell it has worked everywhere for years. And a
 * `table-header-group` is not reliably a box that paints a `box-shadow` at all
 * under `border-collapse`, while a `table-cell` is.
 *
 * The bottom rule is an inset shadow rather than a border because Tailwind's
 * preflight sets `border-collapse: collapse` on every `<table>`, and a collapsed
 * border belongs to the table's border grid rather than to the cell that
 * declared it. `TableHeader`'s own `[&_tr]:border-b` therefore stays behind with
 * the grid the moment the header scrolls - the classic
 * sticky-header-loses-its-line bug. A shadow is painted by the box that moves,
 * so it travels. At rest the two sit on the same pixel in the same colour and
 * read as one line.
 *
 * The cell already carries `bg-secondary/90` from `DENSITY`, which is what a
 * sticky cell needs so rows do not show through it; `backdrop-blur` handles the
 * remaining 10%.
 *
 * `z-30` is above the rows without reaching a Radix portal (`z-50`). A
 * `<tr class="relative">` has `z-index: auto` and creates no stacking context,
 * so the header paints over any row scrolled under it - and over nothing that is
 * still visible, which is why a click aimed at a visible row still lands.
 */
const STICKY = [
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-30",
  "[&_thead_th]:backdrop-blur",
  "[&_thead_th]:shadow-[inset_0_-1px_0_0_var(--border)]",
].join(" ");

export default function TableCard({
  children,
  toolbar,
  footer,
  fill = false,
  className,
}: {
  /** the `<Table>` itself */
  children: React.ReactNode;
  /** a strip above the table but inside the border - reviews' bulk actions */
  toolbar?: React.ReactNode;
  /** a rail below the table but inside the border - a profile tab's "N of M" */
  footer?: React.ReactNode;
  /**
   * Take the remaining height of a `ListPage` and scroll the rows inside the
   * border. Mandatory under `ListPage`; leave it off for a card sitting in
   * ordinary document flow, like the tables on a customer's profile.
   */
  fill?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        DENSITY,
        fill && FILL,
        fill && STICKY,
        "gap-0 overflow-hidden rounded-lg p-0 shadow-none",
        className,
      )}
    >
      {toolbar}
      {children}
      {footer}
    </Card>
  );
}
