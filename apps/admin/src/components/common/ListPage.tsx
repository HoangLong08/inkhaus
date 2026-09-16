import { cn } from "cn";

/**
 * A list page that owns the viewport instead of the document. The heading, the
 * filters, the table and the footer are all on screen at once, and only the rows
 * move - inside the table's own border, under a header that stays put.
 *
 * Every direct child is a flex item that keeps its natural height except the
 * `TableCard`, which must carry `fill`. That is the whole contract: a list that
 * renders a card without it gets a table the height of its rows and a footer
 * stranded halfway up the screen.
 *
 * ---
 *
 * **The height is spelled out rather than flexed down from the layout, and that
 * is deliberate.** `SidebarProvider`'s wrapper is `flex min-h-svh` - a floor, not
 * a height - so nothing below it has a definite height for a percentage or a
 * `flex-basis: 0` to resolve against with any guarantee. The tempting fix is
 * `min-h-0` on `(dash)/layout.tsx`'s shared `<main>`, and it is a trap: that
 * collapses main's min-content contribution to zero, the provider stops growing
 * with its content, and the twelve non-list pages under that layout get clipped
 * instead of scrolled. `calc(100svh - var(--app-header-h))` needs nothing from
 * its ancestors and leaves that layout alone.
 *
 * `--app-header-h` is the same variable `(dash)/layout.tsx` sizes the header
 * with, so the two can never drift.
 *
 * **`svh`, not `vh` or `dvh`.** `vh` is the large viewport and overflows under a
 * phone's retracted browser chrome; `dvh` resizes as that chrome shows and hides,
 * which for a `flex-1 overflow-auto` table is a reflow on every scroll gesture.
 * `svh` is stable and always fits, and it is what `SidebarProvider` already uses
 * one level up.
 *
 * **The negative margins cancel the shell's padding, they do not fight it.**
 * `(dash)/layout.tsx` gives `<main>` `px-4 py-8 md:px-8` because twelve non-list
 * pages want it. A list does not: 4rem of vertical padding is 4rem of rows. A
 * negative margin on a `flex: 1 1 0%` item adds to the free space the item grows
 * into, so `-my-8` gives this box back exactly the 4rem the padding took and its
 * bottom edge lands on 100svh. `p-3` then re-inks a gutter of its own, which is
 * the one the reference uses.
 *
 * `gap-2`, not `space-y-2`: the children are flex items and one of them is
 * `flex-1`, so a gap is what a flex column means by that. The rhythm is
 * identical, and unlike `space-y-*` it does not depend on which child is first.
 */
export default function ListPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-testid="list-page"
      className={cn(
        "-mx-4 -my-8 flex h-[calc(100svh-var(--app-header-h))] min-h-0 flex-col gap-2 p-3 md:-mx-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
