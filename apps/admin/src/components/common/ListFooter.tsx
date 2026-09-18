import { getTranslations } from "next-intl/server";

import PageSizeLinks from "@/components/common/PageSizeLinks";
import Pager from "@/components/Pager";
import { count } from "@/lib/format";
import type { Params } from "@/lib/url";

/**
 * The five lists that render a footer, and the catalogue key for what each one
 * counts. A const map rather than a template-literal key: an indexed access is
 * literal-typed under any compiler, and `ListNoun` is derived from it so the
 * union and the keys cannot drift apart.
 */
const NOUN_KEY = {
  orders: "nouns.orders",
  quotes: "nouns.quotes",
  customers: "nouns.customers",
  products: "nouns.products",
  reviews: "nouns.reviews",
} as const;

export type ListNoun = keyof typeof NOUN_KEY;

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
 * It is also the only place a paginated list prints its total. `ListHeader`'s
 * meta line used to say "134 total · page 1 of 2" a hand's breadth above this
 * row and is gone from all five; `e2e/overview.spec.ts` reads `data-total` here.
 *
 * A Server Component, so the copy comes from `getTranslations("List")`. The
 * range is one message with `<b>` tags rather than three keys composed in JSX:
 * composing would hard-code English word order into the component, which is
 * the thing s9 exists to prevent. The numbers go through `lib/format.ts` and are
 * interpolated as strings - the `data-*` attributes keep the raw values.
 */
export default async function ListFooter({
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
  hideSize = false,
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
  /** what the numbers count - a key into `List.nouns`, never a word */
  noun: ListNoun;
  params?: Params;
  sizes?: readonly number[];
  sizeParam?: string;
  /**
   * For a list whose page size is fixed on purpose and has no `limit` in its
   * URL - `/reviews`, where the API's 20 is what keeps a select-all inside
   * `REVIEW_BULK_MAX`. The range line and the pager still earn their place; a
   * control over a parameter that does not exist does not.
   */
  hideSize?: boolean;
}) {
  const t = await getTranslations("List");
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = (page - 1) * limit + shown;

  return (
    <div
      data-testid="list-footer"
      // px-3, the same gutter as `[&_tbody_td]:px-3` in TableCard, so "Showing
      // 1-20 of 134" starts on the x of the first column's text rather than
      // near it.
      className="flex w-full flex-col items-center justify-between gap-3 px-3 sm:flex-row sm:gap-4"
    >
      <p
        data-testid="list-range"
        // the raw numbers, so a test never has to parse an en dash or a comma
        data-from={from}
        data-to={to}
        data-total={total}
        className="text-muted-foreground order-2 text-center text-xs tabular-nums sm:order-1 sm:flex-1 sm:text-left"
      >
        {t.rich("range", {
          from: count(from),
          to: count(to),
          total: count(total),
          noun: t(NOUN_KEY[noun]),
          b: (chunks) => <span className="text-foreground font-medium">{chunks}</span>,
        })}
      </p>

      <div className="order-1 flex w-full items-center justify-between gap-3 sm:order-2 sm:w-auto sm:gap-6">
        {hideSize ? null : (
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xs font-medium">
              {t("rows.label")}
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
        )}
        <Pager base={base} page={page} pages={pages} params={params} compact />
      </div>
    </div>
  );
}
