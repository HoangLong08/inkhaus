import { useTranslations } from "next-intl";

import { TableCell, TableHead } from "@/components/ui/table";
import { count } from "@/lib/format";

/**
 * The ordinal column - "#" in English, "STT" in Vietnamese - that opens every
 * list table in the back office.
 *
 * It answers "which row is this" without the reader counting, and it gives two
 * people on a call a way to name a row that is not an order number or an email.
 * The UMS source these tables were restyled against - a separate repo, not this
 * one - puts one on almost every table, in a helper called `createSttColumn`.
 * This is that column, written the way this app writes things.
 *
 * ---
 *
 * **The numbering is continuous across pages**, not per page: page 2 of a
 * 20-row list starts at 21. `ordinalFrom` takes the *same* `page` and `limit`
 * the page hands `ListFooter`, which is what keeps the invariant that the first
 * row's `data-ordinal` equals `list-range`'s `data-from`. A list that does not
 * paginate - `/staff`, `/catalog/colors`, `/catalog/sizes` - simply starts at 1.
 *
 * **The index must be the row's position in the array being rendered**, never
 * its position in the array that was passed in. `ReviewsTable` hides a row the
 * moment an optimistic delete starts, so the rows below it renumber at once -
 * which is right, and settles when `router.refresh()` brings the real page back.
 *
 * ---
 *
 * **Why it lives in the `Common` namespace and not in `List`.** Four of the eight
 * tables are `"use client"` (reviews, staff, colours, sizes) and AGENTS.md s4
 * keeps `List` deliberately out of `CHROME_NAMESPACES`, so `useTranslations("List")`
 * would throw in exactly those four. `Common` is already in that set, so one
 * component serves all eight and nothing extra reaches the browser. The two
 * alternatives were a label prop threaded through eight pages, or the whole
 * `List` namespace re-streamed on every navigation with the s4 rule reversed to
 * allow it; this costs neither.
 *
 * **This module has no `"use client"` and must never import `next-intl/server`.**
 * Both halves are load-bearing: without the first it could not be used from the
 * four client tables, and with the second it could not be compiled into their
 * bundles at all. `useTranslations` is a hook, so `OrdinalHead` is a sync
 * component - an `async` page (`/quotes`, `/catalog` render their tables inline)
 * renders it rather than calling the hook itself.
 */

/** The ordinal of a page's first row: 1, 21, 41… ; 1 where a list does not paginate. */
export const ordinalFrom = (page = 1, limit = 0) => (page - 1) * limit + 1;

/**
 * The `<th>`'s own classes, exported so `TableSkeleton` can reserve exactly the
 * same width and the header row does not shift when the data lands.
 *
 * `w-12` (3rem) and not `w-[44px]`: s2 says every length in a component is `rem`,
 * because the root font-size ladder is this app's density knob. At the 14px root
 * the e2e suite and a laptop both see, "STT" at `text-xs` runs ~19px inside
 * `TableCard`'s 21px of `px-3` gutters - 40px, which 42px covers and `w-10`'s
 * 35px would not.
 *
 * Centred rather than the `text-right tabular-nums` every other numeric column
 * here uses, because that is what the style reference does with this particular
 * column. `tabular-nums` stays: 9 → 10 → 100 must not change the column's width.
 */
export const ORDINAL_HEAD = "w-12 text-center";

/**
 * The `<td>`'s own classes, exported for the same reason as `ORDINAL_HEAD`.
 *
 * `text-muted-foreground` is on the cell and never on the head: every other `<th>`
 * inherits `text-foreground` from the primitive, and one grey heading reads as a
 * bug rather than as a choice.
 *
 * It must contain no `py-`. `TableCard`'s `[&_tbody_td:not([class*='py-'])]:py-0`
 * steps aside for a cell that states its own vertical padding, and this one wants
 * the 36px row.
 */
export const ORDINAL_CELL = "text-muted-foreground text-center tabular-nums";

/**
 * `aria-label` on the `<th>` rather than the visible text alone. A `<th>` is a
 * `columnheader`, which takes a name from the author, and neither "#" nor "STT"
 * is a word a screen reader can say - one is punctuation, the other an
 * abbreviation.
 */
export function OrdinalHead() {
  const t = useTranslations("Common");

  return (
    <TableHead scope="col" className={ORDINAL_HEAD} aria-label={t("ordinal.aria")}>
      {t("ordinal.label")}
    </TableHead>
  );
}

/**
 * One row's ordinal.
 *
 * It must never be given `position`, `sticky` or `z-index`. Four of these tables
 * stretch a row link's `::after` over `inset-0` of a `relative` `<tr>`; a
 * positioned first cell becomes the nearest positioned ancestor and shrinks the
 * whole row's link down to itself (AGENTS.md s1).
 *
 * The number is in `data-ordinal` as well as in the text, so a test compares it
 * with `list-range`'s `data-from` attribute-to-attribute and never parses a
 * thousands separator.
 */
export function OrdinalCell({ n }: { n: number }) {
  return (
    <TableCell data-testid="row-ordinal" data-ordinal={n} className={ORDINAL_CELL}>
      {count(n)}
    </TableCell>
  );
}
