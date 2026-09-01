import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { adminApi, type OrderStatus } from "@/lib/api";
import { on, usd } from "@/lib/format";

export const metadata = { title: "Overview — INKHAUS Back Office" };

/** the statuses someone actually has to do something about */
const QUEUES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED"];

export default async function DashboardPage() {
  // there is no stats endpoint, so each tile is a limit=1 list read for its
  // meta.total. Cheap, and it cannot drift from what the list pages show.
  const [recent, newQuotes, ...queues] = await Promise.all([
    adminApi.orders({ page: 1 }),
    adminApi.quotes({ status: "NEW" }),
    ...QUEUES.map((status) => adminApi.orders({ status })),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUEUES.map((status, i) => (
            <Link
              key={status}
              href={`/orders?status=${status}`}
              className="rounded-lg border border-line bg-paper p-4 transition hover:border-ink-3"
            >
              <p className="text-2xl font-bold tabular-nums">{queues[i].meta.total}</p>
              <p className="mt-1.5">
                <StatusBadge status={status} />
              </p>
            </Link>
          ))}
          <Link
            href="/quotes?status=NEW"
            className="rounded-lg border border-line bg-paper p-4 transition hover:border-ink-3"
          >
            <p className="text-2xl font-bold tabular-nums">{newQuotes.meta.total}</p>
            <p className="mt-1.5 text-xs font-semibold text-ink-3">New bulk quotes</p>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Latest orders
          </h2>
          <Link href="/orders" className="text-sm font-medium text-sky hover:underline">
            All {recent.meta.total} →
          </Link>
        </div>

        {recent.data.length === 0 ? (
          <p className="rounded-lg border border-line bg-paper p-6 text-sm text-ink-3">
            No orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
            {recent.data.slice(0, 8).map((order) => (
              <li key={order.number}>
                <Link
                  href={`/orders/${order.number}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-paper-2"
                >
                  <span className="font-mono text-sm font-semibold">{order.number}</span>
                  <StatusBadge status={order.status} />
                  <span className="truncate text-sm text-ink-2">{order.customer.email}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums">
                    {usd(order.total)}
                  </span>
                  <span className="w-24 text-right text-xs text-ink-3">
                    {on(order.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
