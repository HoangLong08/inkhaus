"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  Mail,
  Package,
  PartyPopper,
  Printer,
  RefreshCw,
  Truck,
} from "lucide-react";
import Garment from "@/components/Garment";
import { ApiError, api, type OrderDto, type OrderStatus as Status } from "@/lib/api";
import { getProduct } from "@/lib/catalog";
import { METHOD_LABEL } from "@/lib/cart";

/** the happy path, in the order the back office walks it */
const TRACK: Status[] = ["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED", "DELIVERED"];

const META: Record<Status, { label: string; blurb: string; icon: typeof Check }> = {
  DRAFT: { label: "Draft", blurb: "Not submitted yet.", icon: Package },
  PENDING_PAYMENT: {
    label: "Order placed",
    blurb: "We are preparing your digital proof — it lands in your inbox within two hours.",
    icon: Mail,
  },
  PAID: { label: "Paid", blurb: "Payment received. Into the queue it goes.", icon: CreditCard },
  IN_PRODUCTION: {
    label: "On the press",
    blurb: "Being printed, cured and quality-checked in the USA.",
    icon: Printer,
  },
  SHIPPED: { label: "Shipped", blurb: "On its way — 3–5 day US delivery.", icon: Truck },
  DELIVERED: { label: "Delivered", blurb: "Enjoy them. Tag us.", icon: PartyPopper },
  CANCELLED: { label: "Cancelled", blurb: "This order was cancelled.", icon: AlertTriangle },
  REFUNDED: { label: "Refunded", blurb: "This order was refunded.", icon: AlertTriangle },
};

const money = (n: number) => `$${n.toFixed(2)}`;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export default function OrderStatus({ number }: { number: string }) {
  const justPlaced = useSearchParams().get("placed") === "1";
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  /** bumped by Refresh; re-runs the fetch without duplicating it */
  const [attempt, setAttempt] = useState(0);

  // State is only ever set from the promise's callbacks, never from the effect
  // body — the effect's job here is to start the request and to disown it if the
  // order number changes underneath us.
  useEffect(() => {
    let cancelled = false;
    api
      .order(number)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "Could not load that order."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [number, attempt]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  if (loading && !order) {
    return (
      <Shell>
        <div className="flex items-center gap-3 py-24 text-[13px] uppercase tracking-[0.16em] text-ink/40">
          <Loader2 size={16} className="animate-spin" aria-hidden /> Looking up {number}…
        </div>
      </Shell>
    );
  }

  if (error && !order) {
    const missing = error.status === 404;
    return (
      <Shell>
        <div className="max-w-lg py-16">
          <h1 className="display text-[clamp(2.2rem,6vw,3.4rem)]">
            {missing ? "No such order" : "Can't reach the server"}
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-ink/55">
            {missing ? (
              <>
                We have nothing under <b className="text-ink">{number}</b>. Check the number in your
                confirmation email — it looks like <code>INK-000123</code>.
              </>
            ) : (
              error.message
            )}
          </p>
          {justPlaced && !missing && (
            <p className="mt-4 rounded-xl bg-paper-2 p-4 text-[13px] leading-relaxed text-ink/55">
              Your order <b className="text-ink">{number}</b> was accepted — this page just could not
              load its detail. Nothing is lost; try again in a moment.
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink"
            >
              <RefreshCw size={14} aria-hidden /> Try again
            </button>
            <Link
              href="/orders"
              className="rounded-full border hairline px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink/70 hover:border-ink hover:text-ink"
            >
              Look up another order
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!order) return null;

  const meta = META[order.status];
  const stage = TRACK.indexOf(order.status);
  const closed = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <Shell>
      <div className="pb-24">
        {justPlaced && (
          <div className="mb-9 flex items-start gap-3 rounded-2xl border border-acid-2/40 bg-acid/15 px-5 py-4">
            <Check size={18} className="mt-0.5 shrink-0 text-acid-2" aria-hidden />
            <div className="text-[13px] leading-relaxed">
              <p className="font-semibold">That&apos;s the order in.</p>
              <p className="text-ink/60">
                A confirmation is on its way to {order.customer.email}. Keep this number —{" "}
                <b className="text-ink">{order.number}</b> — it is how you check back in.
              </p>
            </div>
          </div>
        )}

        <header className="flex flex-wrap items-end justify-between gap-5 border-b hairline pb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">
              Order {order.number}
            </p>
            <h1 className="display mt-4 text-[clamp(2.4rem,7vw,4.6rem)]">{meta.label}</h1>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink/55">{meta.blurb}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border hairline px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/60 transition hover:border-ink hover:text-ink disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden /> Refresh
          </button>
        </header>

        {!closed && (
          <ol className="mt-9 grid gap-3 sm:grid-cols-5">
            {TRACK.map((s, i) => {
              const done = i <= stage;
              const Icon = META[s].icon;
              return (
                <li
                  key={s}
                  aria-current={i === stage ? "step" : undefined}
                  className={`rounded-2xl border p-4 transition ${
                    done ? "border-acid-2 bg-acid/10" : "hairline bg-paper-2"
                  }`}
                >
                  <Icon
                    size={16}
                    className={done ? "text-acid-2" : "text-ink/30"}
                    aria-hidden
                  />
                  <p
                    className={`mt-2 text-[11px] font-bold uppercase tracking-[0.12em] ${
                      done ? "text-ink" : "text-ink/35"
                    }`}
                  >
                    {META[s].label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
          <section>
            <h2 className="display text-[24px]">What we are printing</h2>
            <ul className="mt-5 space-y-4">
              {order.items.map((item, i) => {
                const product = getProduct(item.productSlug);
                return (
                  <li key={i} className="flex gap-4 rounded-2xl border hairline bg-paper p-4">
                    <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border hairline bg-paper-2">
                      <Garment
                        type={product?.type ?? "tee"}
                        color={item.color.hex}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{item.productName}</p>
                      <p className="mt-0.5 text-[12px] text-ink/45">
                        {item.color.name} · {METHOD_LABEL[item.method] ?? item.method}
                        {item.designId ? " · custom artwork" : ""}
                      </p>
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {item.sizes.map((s) => (
                          <span
                            key={s.size}
                            className="rounded-lg border hairline bg-paper-2 px-2 py-0.5 text-[11px]"
                          >
                            <b className="uppercase tracking-[0.08em] text-ink/60">{s.size}</b>{" "}
                            <span className="tabular-nums">×{s.qty}</span>
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-semibold tabular-nums">
                        {money(item.lineTotal)}
                      </p>
                      <p className="text-[11px] text-ink/40">
                        {item.quantity} × {money(item.unitPrice)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <h2 className="display mt-12 text-[24px]">Timeline</h2>
            <ol className="mt-5 space-y-4 border-l hairline pl-6">
              {[...order.timeline].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${
                      i === 0 ? "bg-acid-2" : "bg-ink/20"
                    }`}
                    aria-hidden
                  />
                  <p className="text-[13px] font-semibold">{META[e.status]?.label ?? e.status}</p>
                  {/* the API's own note for a new order is "Order placed", which
                      is the heading above it — only show one that adds something */}
                  {e.note && e.note !== META[e.status]?.label && (
                    <p className="text-[12px] text-ink/50">{e.note}</p>
                  )}
                  <p className="text-[11px] uppercase tracking-[0.1em] text-ink/35">{when(e.at)}</p>
                </li>
              ))}
            </ol>
          </section>

          <aside className="space-y-6 lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:h-fit">
            <div className="rounded-3xl border hairline bg-paper-2 p-6">
              <h2 className="display text-[20px]">Totals</h2>
              <dl className="mt-4 space-y-2 border-t hairline pt-4 text-[14px]">
                <Row label="Subtotal" value={money(order.subtotal)} />
                {order.discount > 0 && (
                  <Row label="Discount" value={`− ${money(order.discount)}`} tone="acid" />
                )}
                <Row
                  label="Shipping"
                  value={order.shipping === 0 ? "Free" : money(order.shipping)}
                />
                {order.tax > 0 && <Row label="Tax" value={money(order.tax)} />}
              </dl>
              <div className="mt-4 flex items-end justify-between border-t hairline pt-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
                  Total
                </span>
                <span className="display text-[30px] leading-none tabular-nums">
                  {money(order.total)}
                </span>
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-ink/35">
                Placed {when(order.placedAt ?? order.createdAt)}
              </p>
            </div>

            <div className="rounded-3xl border hairline p-6">
              <h2 className="display text-[20px]">Shipping to</h2>
              <address className="mt-3 space-y-0.5 text-[13px] not-italic leading-relaxed text-ink/60">
                <p className="font-semibold text-ink">
                  {order.shippingAddress.name ?? order.customer.name ?? order.customer.email}
                </p>
                {order.shippingAddress.line1 && <p>{order.shippingAddress.line1}</p>}
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {[order.shippingAddress.city, order.shippingAddress.state]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {order.shippingAddress.postal}
                </p>
                <p>{order.shippingAddress.country}</p>
              </address>
              {order.notes && (
                <>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">
                    Your note
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink/60">{order.notes}</p>
                </>
              )}
            </div>

            <div className="rounded-3xl border hairline bg-ink p-6 text-paper">
              <p className="display text-[20px]">Need to change something?</p>
              <p className="mt-2 text-[13px] leading-relaxed text-paper/60">
                Nothing goes on the press until you approve the proof. Reply to the confirmation
                email and we will fix it.
              </p>
              <a
                href={`mailto:hello@inkhaus.example?subject=${encodeURIComponent(`Order ${order.number}`)}`}
                className="mt-4 inline-flex rounded-full bg-acid px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink"
              >
                Email us about {order.number}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge">{children}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "acid" }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/50">{label}</dt>
      <dd className={`tabular-nums ${tone === "acid" ? "text-acid-2" : ""}`}>{value}</dd>
    </div>
  );
}
