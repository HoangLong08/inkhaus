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
 * Every control in this row is the default `h-9`. A `size="sm"` trigger here
 * reads as a 4px step beside the search box, which is what the date picker used
 * to do.
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-64 flex-1">
        <UrlSearchBox
          param="q"
          aliases={["email"]}
          label="Search orders"
          placeholder="Order number, email or name…"
          testId="orders-search"
          clearTestId="orders-search-clear"
        />
      </div>
      <DateRangePicker prefix="orders" from={params.from} to={params.to} placeholder="Placed any day" />
      <OrdersColumnsMenu
        cols={params.cols}
        sort={params.sort}
        page={params.page}
        linkParams={linkParams}
      />
      {actions}
    </div>
  );
}
