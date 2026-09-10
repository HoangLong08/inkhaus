import UrlSearchBox from "@/components/common/UrlSearchBox";

/**
 * The orders search. Free text over the order number, customer email and names
 * - the API's `q` - where it used to be an exact-email filter that 400'd on
 * every half-typed address. `?email=` from an old bookmark is still read, and
 * rewritten to `q` on the next keystroke.
 */
export default function OrdersToolbar() {
  return (
    <UrlSearchBox
      param="q"
      aliases={["email"]}
      label="Search orders"
      placeholder="Order number, email or name…"
      testId="orders-search"
      clearTestId="orders-search-clear"
    />
  );
}
