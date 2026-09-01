import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { adminApi, type OrderStatus } from "@/lib/api";
import { on, usd } from "@/lib/format";

export const metadata = { title: "Orders — INKHAUS Back Office" };

const STATUSES: OrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; email?: string }>;
}) {
  const params = await searchParams;
  // an unknown ?status= would be a 400 from the API's validation pipe, so drop
  // anything that is not a real enum value rather than passing it through
  const status = STATUSES.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { data, meta } = await adminApi.orders({ page, status, email: params.email });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-ink-3">
          {meta.total} total · page {meta.page} of {meta.pages}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        <FilterChip href="/orders" active={!status}>
          All
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} href={`/orders?status=${s}`} active={status === s}>
            <StatusBadge status={s} />
          </FilterChip>
        ))}
      </nav>

      {data.length === 0 ? (
        <p className="rounded-lg border border-line bg-paper p-6 text-sm text-ink-3">
          No orders match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-line bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Order</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 text-right font-semibold">Items</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 text-right font-semibold">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((order) => (
                <tr key={order.number} className="transition hover:bg-paper-2">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/orders/${order.number}`}
                      className="font-mono font-semibold text-sky hover:underline"
                    >
                      {order.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-2.5 text-ink-2">
                    {order.customer.email}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">
                    {order.items.reduce((n, i) => n + i.quantity, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {usd(order.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-3">
                    {on(order.placedAt ?? order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={meta.page} pages={meta.pages} status={status} />
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-2 py-1 text-xs font-semibold transition ${
        active ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:bg-paper-2"
      }`}
    >
      {children}
    </Link>
  );
}

function Pager({ page, pages, status }: { page: number; pages: number; status?: string }) {
  if (pages <= 1) return null;
  const qs = (n: number) =>
    `/orders?${new URLSearchParams({ ...(status ? { status } : {}), page: String(n) })}`;

  return (
    <div className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={qs(page - 1)} className="font-medium text-sky hover:underline">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      {page < pages ? (
        <Link href={qs(page + 1)} className="font-medium text-sky hover:underline">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
