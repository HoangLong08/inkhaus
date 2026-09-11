import type { NextRequest } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { ordersQuerySchema } from "@/lib/schemas/params";

/**
 * The owner's CSV of the orders list. The Export button is a plain link here
 * carrying the list's own query string, which is why this parses with the page's
 * schema: whatever the list is showing, the file holds every page of it.
 *
 * Owners only - the BFF third of the capability rule; the button is not drawn
 * for staff and the API refuses them again with `@Can('orders.export')`.
 *
 * The upstream body is handed on unread, so a ten-thousand-row file streams
 * through rather than sitting in this server's memory. Only the headers named
 * below are forwarded, never the upstream's wholesale.
 */
export const GET = route(async (request: NextRequest) => {
  await requireCapability("orders.export");
  const params = ordersQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const upstream = await adminApi.orders.exportCsv(params);

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
    "content-disposition":
      upstream.headers.get("content-disposition") ?? 'attachment; filename="orders.csv"',
    // personal data in bulk: no shared cache, no back-button copy
    "cache-control": "no-store",
  });
  const truncated = upstream.headers.get("x-export-truncated");
  if (truncated) headers.set("x-export-truncated", truncated);

  return new Response(upstream.body, { headers });
});
