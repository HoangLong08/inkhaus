import { ORDER_EXPORT_MAX } from "@inkhaus/shared/orders";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { count } from "@/lib/format";
import type { OrdersQuery } from "@/lib/schemas/params";
import { hrefWith, type Params } from "@/lib/url";

/**
 * "Export CSV" for the list as it stands. Owners only - the page does not
 * render this for anyone without `orders.export`.
 *
 * A plain `<a>`, not next/link: the target is a route handler that answers with
 * a file, not a page to navigate to. `download` keeps the list on screen, and
 * makes a refused or failed export a failed download rather than a JSON error
 * document replacing the page.
 *
 * The href carries the list's filters and sort but not its paging - the file is
 * every page. The browser never sees the export's own headers, so when more
 * orders match than a file holds (`ORDER_EXPORT_MAX`, the cap the API enforces)
 * this says so beside the button, from the total the page already has.
 */
export default function OrdersExportButton({
  params,
  linkParams,
  total,
}: {
  params: OrdersQuery;
  linkParams: Params;
  /** how many orders match - the page's `meta.total` */
  total: number;
}) {
  if (total === 0) {
    // an empty file is not worth a download
    return (
      <Button variant="outline" size="sm" disabled data-testid="orders-export">
        <Download />
        Export CSV
      </Button>
    );
  }

  const href = hrefWith("/api/admin/exports/orders", {
    q: params.q,
    status: params.status,
    from: params.from,
    to: params.to,
    sort: linkParams.sort,
  });
  const capped = total > ORDER_EXPORT_MAX;

  return (
    <div className="flex items-center gap-2">
      {capped ? (
        <span className="text-muted-foreground text-xs" data-testid="orders-export-capped">
          First {count(ORDER_EXPORT_MAX)} of {count(total)}
        </span>
      ) : null}
      <Button asChild variant="outline" size="sm">
        <a href={href} download data-testid="orders-export" data-capped={capped}>
          <Download />
          Export CSV
        </a>
      </Button>
    </div>
  );
}
