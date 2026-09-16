import PageSizeLinks from "@/components/common/PageSizeLinks";
import Pager from "@/components/Pager";
import { count } from "@/lib/format";
import type { Params } from "@/lib/url";

/**
 * The row under a list's table: what you are looking at on the left, how to
 * change it on the right. It sits below the table's border rather than inside it,
 * and on a narrow screen the controls come first (`order-1`) so the thing you act
 * on is not pushed below the thing you only read.
 *
 * It composes the two controls that already exist rather than reimplementing
 * them: `PageSizeLinks` keeps its `page-size` / `data-limit` / `aria-current`
 * contract, and `Pager` keeps its own. Because both are here, a page that renders
 * a `ListFooter` must **stop rendering them anywhere else** - two elements with
 * the same `data-testid` is a Playwright strict-mode failure, not a layout bug.
 *
 * This does not replace `ListHeader`'s meta line. That line is the page's total,
 * asserted by `e2e/overview.spec.ts` (a stat tile's count must equal the first
 * number in `orders-meta`), so the range below is a second, differently-shaped
 * fact under its own id.
 */
export default function ListFooter({
  base,
  page,
  pages,
  limit,
  total,
  shown,
  noun,
  params = {},
  sizes,
  sizeParam,
}: {
  base: string;
  page: number;
  pages: number;
  limit: number;
  total: number;
  /**
   * How many rows this page actually rendered - `data.length`, not
   * `min(page * limit, total)`. The last page is short, and an arithmetic guess
   * reads "showing 81-100 of 87" on it.
   */
  shown: number;
  /** "orders", "customers" - what the numbers count */
  noun?: string;
  params?: Params;
  sizes?: readonly number[];
  sizeParam?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = (page - 1) * limit + shown;

  return (
    <div
      data-testid="list-footer"
      className="flex w-full flex-col items-center justify-between gap-3 px-1 sm:flex-row sm:gap-4"
    >
      <p
        data-testid="list-range"
        // the raw numbers, so a test never has to parse an en dash or a comma
        data-from={from}
        data-to={to}
        data-total={total}
        className="text-muted-foreground order-2 text-center text-xs tabular-nums sm:order-1 sm:flex-1 sm:text-left"
      >
        Showing{" "}
        <span className="text-foreground font-medium">
          {count(from)}&ndash;{count(to)}
        </span>{" "}
        of <span className="text-foreground font-medium">{count(total)}</span>
        {noun ? ` ${noun}` : null}
      </p>

      <div className="order-1 flex w-full items-center justify-between gap-3 sm:order-2 sm:w-auto sm:gap-6">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xs font-medium">
            Rows
          </span>
          <PageSizeLinks
            base={base}
            params={params}
            active={limit}
            sizes={sizes}
            param={sizeParam}
            hideLabel
          />
        </div>
        <Pager base={base} page={page} pages={pages} params={params} compact />
      </div>
    </div>
  );
}
