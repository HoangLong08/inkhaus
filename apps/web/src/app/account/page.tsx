import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { signOut } from "@/app/actions";
import type { OrderDto } from "@/lib/api";
import { requireCustomer } from "@/lib/dal";
import { accountApi, ApiError } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Your orders — INKHAUS",
  robots: { index: false, follow: false },
};

const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_LABEL: Record<OrderDto["status"], string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Order placed",
  PAID: "Paid",
  IN_PRODUCTION: "On the press",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export default async function AccountPage() {
  const customer = await requireCustomer();

  // The API being down must not turn "your account" into an error screen: the
  // header, the name and the sign-out button are all still true and useful.
  let orders: OrderDto[] = [];
  let listFailed = false;
  try {
    orders = (await accountApi.myOrders()).data;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    listFailed = true;
  }

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge pb-28">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b hairline pb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">
              Your account
            </p>
            <h1 className="display mt-4 text-[clamp(2.4rem,7vw,4.6rem)]">
              {customer.name ? `Hi, ${customer.name.split(" ")[0]}` : "Your orders"}
            </h1>
            <p className="mt-3 text-[13px] text-ink/45" data-testid="account-email">
              {customer.email}
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              data-testid="sign-out"
              className="rounded-full border hairline px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink/60 transition hover:border-ink hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </header>

        {listFailed ? (
          <p role="alert" className="mt-10 text-[14px] text-flame">
            We could not load your orders just now. Refresh in a moment — nothing is lost.
          </p>
        ) : orders.length === 0 ? (
          <section className="mt-14 max-w-lg">
            <h2 className="display text-[26px]">Nothing here yet</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink/50">
              Orders placed with <span className="text-ink/70">{customer.email}</span> show up here
              automatically — including any you placed as a guest before signing in.
            </p>
            <Link
              href="/design"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-paper transition hover:bg-acid hover:text-ink"
            >
              Start designing <ArrowRight size={14} aria-hidden />
            </Link>
          </section>
        ) : (
          <section className="mt-12">
            <h2 className="display text-[26px]">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </h2>
            <ul
              data-testid="account-orders"
              className="mt-5 max-w-3xl divide-y divide-ink/10 border-y hairline"
            >
              {orders.map((o) => (
                <li key={o.number}>
                  <Link
                    href={`/orders/${encodeURIComponent(o.number)}`}
                    className="group flex flex-wrap items-center justify-between gap-4 py-5 transition hover:text-acid-2"
                  >
                    <span>
                      <span className="text-[15px] font-semibold">{o.number}</span>
                      <span className="ml-3 text-[12px] text-ink/40">
                        {STATUS_LABEL[o.status]}
                        {o.placedAt
                          ? ` · ${new Date(o.placedAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}`
                          : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-[15px] font-semibold tabular-nums">
                        {money(o.total)}
                      </span>
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
