import DateRangePicker from "@/components/common/DateRangePicker";
import PageSizeLinks from "@/components/common/PageSizeLinks";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import type { OrdersQuery } from "@/lib/schemas/params";
import type { Params } from "@/lib/url";

/**
 * The controls above the orders table: search, placed-date range and rows per
 * page. All three write the URL and none of them fetches - the page re-renders
 * from what they wrote, and the result is a link someone else can open.
 *
 * The search is free text over the order number, customer email and names - the
 * API's `q` - where it used to be an exact-email filter that 400'd on every
 * half-typed address. `?email=` from an old bookmark is still read, and
 * rewritten to `q` on the next keystroke.
 */
export default function OrdersToolbar({
  params,
  linkParams,
}: {
  /** the page's parsed params */
  params: OrdersQuery;
  /** the same, as the list's links carry them - see `ordersLinkParams` */
  linkParams: Params;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-60 flex-1">
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
      <PageSizeLinks base="/orders" params={linkParams} active={params.limit} />
    </div>
  );
}
