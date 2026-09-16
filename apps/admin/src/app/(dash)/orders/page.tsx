import { can } from "@inkhaus/shared/admin";
import { Suspense } from "react";

import ListFooter from "@/components/common/ListFooter";
import ListHeader from "@/components/common/ListHeader";
import OrdersToolbar from "@/components/orders/OrdersToolbar";
import OrdersEmpty from "@/components/orders-list/OrdersEmpty";
import OrdersExportButton from "@/components/orders-list/OrdersExportButton";
import OrdersKpiStrip, { OrdersKpiStripSkeleton } from "@/components/orders-list/OrdersKpiStrip";
import OrdersTable from "@/components/orders-list/OrdersTable";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { ordersLinkParams, ordersQuerySchema } from "@/lib/schemas/params";
import { hrefWith } from "@/lib/url";

export const metadata = { title: "Orders — INKHAUS Back Office" };

/**
 * Fully server rendered: the table is a pure projection of the URL, so there is
 * nothing here for a client cache to hold that the server does not already know.
 * The search box and the date picker are client components, and they navigate
 * rather than fetch; every other control is a link.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Every field ends in .catch(), so this cannot throw: an unknown ?status= or
  // ?sort= is dropped rather than passed to the API, a junk ?page= falls back to
  // 1, a backwards date range is turned round, and a legacy ?email= is read as
  // the free-text q.
  const params = ordersQuerySchema.parse(await searchParams);
  // requireAdmin is the layout's own call, React-cached - no second round trip
  const [user, { data, meta }] = await Promise.all([requireAdmin(), adminApi.orders.list(params)]);
  const linkParams = ordersLinkParams(params);

  const filtered = Boolean(params.q || params.status || params.from || params.to);
  const emptyReason = meta.total > 0 ? "page" : filtered ? "filtered" : "none";

  return (
    <div className="space-y-2">
      <ListHeader
        title="Orders"
        description="Every order the storefront has taken. The queue counts are all-time; the table follows the filters you set."
        meta={`${meta.total} total · page ${meta.page} of ${meta.pages}`}
        metaTestId="orders-meta"
      />

      {/* its own boundary: a slow stats call must not hold the table back */}
      <Suspense fallback={<OrdersKpiStripSkeleton />}>
        <OrdersKpiStrip active={params.status} linkParams={linkParams} />
      </Suspense>

      <OrdersToolbar
        params={params}
        linkParams={linkParams}
        actions={
          can(user.role, "orders.export") ? (
            <OrdersExportButton params={params} linkParams={linkParams} total={meta.total} />
          ) : null
        }
      />

      {data.length > 0 ? (
        <>
          <OrdersTable
            orders={data}
            sort={params.sort}
            cols={params.cols}
            linkParams={linkParams}
          />
          <ListFooter
            base="/orders"
            page={meta.page}
            pages={meta.pages}
            limit={params.limit}
            total={meta.total}
            shown={data.length}
            noun="orders"
            params={linkParams}
          />
        </>
      ) : (
        <OrdersEmpty
          reason={emptyReason}
          actionHref={
            emptyReason === "page"
              ? hrefWith("/orders", linkParams, { page: meta.pages })
              : // clearing the filters keeps how the list is sorted and sized
                hrefWith("/orders", { sort: linkParams.sort, limit: linkParams.limit })
          }
        />
      )}
    </div>
  );
}
