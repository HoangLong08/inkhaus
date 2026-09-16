import DateRangePicker from "@/components/common/DateRangePicker";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import OrdersColumnsMenu from "@/components/orders/OrdersColumnsMenu";
import type { OrdersQuery } from "@/lib/schemas/params";
import type { Params } from "@/lib/url";

/**
 * The controls above the orders table: search, placed-date range, which columns
 * to draw, and whatever the page puts in `actions`. Every one of them writes the
 * URL and none of them fetches - the page re-renders from what they wrote, and
 * the result is a link someone else can open.
 *
 * The search is free text over the order number, customer email and names - the
 * API's `q` - where it used to be an exact-email filter that 400'd on every
 * half-typed address. `?email=` from an old bookmark is still read, and
 * rewritten to `q` on the next keystroke.
 *
 * Rows per page used to sit here. It moved into `ListFooter`, next to the pager
 * it belongs with - and it must exist in exactly one place on the page, because
 * two elements sharing `data-testid="page-size"` fail Playwright outright.
 *
 * Every control in this row is the one toolbar scale - `TOOLBAR_BUTTON` /
 * `TOOLBAR_INPUT` from `common/toolbar-styles`, which is 32px tall with a 12px
 * label and a 14px glyph - laid out on `gap-2`. The row only reads as a row when
 * all of it agrees; the date picker used to be `h-8` beside an `h-9` search box
 * and the 4px step was visible across the whole width of the page.
 */
export default function OrdersToolbar({
  params,
  linkParams,
  actions,
}: {
  /** the page's parsed params */
  params: OrdersQuery;
  /** the same, as the list's links carry them - see `ordersLinkParams` */
  linkParams: Params;
  /** page-level buttons that belong with the controls - Export */
  actions?: React.ReactNode;
}) {
  return (
    // Two groups, not one wrapping row: what narrows the list on the left, what
    // acts on it or on the view on the right. The search box used to be
    // `flex-1`, which swallowed every pixel the other controls did not want and
    // left a 700px input beside four small buttons.
    <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <UrlSearchBox
            param="q"
            aliases={["email"]}
            label="Search orders"
            placeholder="Order number, email or name…"
            testId="orders-search"
            clearTestId="orders-search-clear"
          />
        </div>
        <DateRangePicker
          prefix="orders"
          from={params.from}
          to={params.to}
          placeholder="Placed any day"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OrdersColumnsMenu
          cols={params.cols}
          sort={params.sort}
          page={params.page}
          linkParams={linkParams}
        />
        {actions}
      </div>
    </div>
  );
}
