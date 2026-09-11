import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Why the price fields are locked while CATALOG_PRICE_EDITS is off (D13).
 * Shown to everyone on every screen with a price on it, so nobody reads a
 * disabled input as a bug.
 */
export default function PriceSyncWarning() {
  return (
    <Alert data-testid="price-sync-warning">
      <TriangleAlert />
      <AlertTitle>Price edits are switched off</AlertTitle>
      <AlertDescription>
        <p>
          The storefront still shows prices from code, while checkout charges what is in the
          database. Until the storefront reads prices from the API, a price changed here would put
          one number on the product page and charge another - so prices, size upcharges and the
          tier ladder are read-only. Copy, colours and archiving still save.
        </p>
      </AlertDescription>
    </Alert>
  );
}
