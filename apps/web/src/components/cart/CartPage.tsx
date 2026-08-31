"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, PenLine, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import LineThumb from "@/components/cart/LineThumb";
import SizeGrid from "@/components/cart/SizeGrid";
import { FreeShippingMeter, TierHint } from "@/components/cart/Meters";
import { readCart, useCart, type ResolvedLine } from "@/lib/cart";
import { colorSlug } from "@/lib/cart";
import { sizesFor } from "@/lib/catalog";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const [confirmClear, setConfirmClear] = useState(false);

  const { lines: resolved, totals } = useMemo(() => readCart(lines), [lines]);

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge pb-24">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b hairline pb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">Step 1 of 2</p>
            <h1 className="display mt-4 text-[clamp(2.6rem,8vw,5.5rem)]">Your cart</h1>
          </div>
          {hydrated && resolved.length > 0 && (
            <p className="text-[13px] text-ink/50">
              {totals.quantity} {totals.quantity === 1 ? "piece" : "pieces"} across {resolved.length}{" "}
              {resolved.length === 1 ? "line" : "lines"}
            </p>
          )}
        </header>

        {!hydrated ? (
          <CartSkeleton />
        ) : resolved.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] lg:gap-14">
            <div>
              <ul className="space-y-5">
                <AnimatePresence initial={false}>
                  {resolved.map((line) => (
                    <CartLineCard key={line.id} line={line} />
                  ))}
                </AnimatePresence>
              </ul>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/products"
                  className="link-underline text-[12px] font-bold uppercase tracking-[0.14em] text-ink/60 hover:text-ink"
                >
                  ← Keep shopping
                </Link>
                {confirmClear ? (
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="text-ink/55">Empty the whole cart?</span>
                    <button
                      onClick={() => {
                        clear();
                        setConfirmClear(false);
                      }}
                      className="rounded-full bg-flame px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-paper"
                    >
                      Yes, clear it
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="rounded-full border hairline px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/60 hover:text-ink"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink/40 transition hover:text-flame"
                  >
                    Clear cart
                  </button>
                )}
              </div>
            </div>

            <aside className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:h-fit">
              <div className="rounded-3xl border hairline bg-paper-2 p-6">
                <h2 className="display text-[22px]">Summary</h2>

                <dl
                  data-testid="cart-summary"
                  data-subtotal={totals.subtotal.toFixed(2)}
                  data-quantity={totals.quantity}
                  className="mt-5 space-y-2 border-t hairline pt-5 text-[14px]"
                >
                  <SummaryRow label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
                  {totals.savings > 0 && (
                    <SummaryRow
                      label={`Volume discount`}
                      value={`− $${totals.savings.toFixed(2)}`}
                      tone="acid"
                    />
                  )}
                  <SummaryRow
                    label="Shipping"
                    value={totals.shipping === 0 ? "Free" : `$${totals.shipping.toFixed(2)}`}
                  />
                  {totals.tax > 0 && <SummaryRow label="Tax" value={`$${totals.tax.toFixed(2)}`} />}
                </dl>

                <div className="mt-5 flex items-end justify-between border-t hairline pt-5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
                    Total
                  </span>
                  <span
                    data-testid="cart-total"
                    className="display text-[clamp(2rem,5vw,2.8rem)] leading-none tabular-nums"
                  >
                    ${totals.total.toFixed(2)}
                  </span>
                </div>

                <div className="mt-5">
                  <FreeShippingMeter subtotal={totals.subtotal} />
                </div>

                <Link
                  href="/checkout"
                  className="group mt-6 flex items-center justify-center gap-2 rounded-full bg-acid py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
                >
                  Checkout
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>

                <ul className="mt-5 space-y-2.5 text-[12px] text-ink/50">
                  <li className="flex items-center gap-2">
                    <ShieldCheck size={14} className="shrink-0 text-acid-2" aria-hidden /> Free digital
                    proof before anything is printed
                  </li>
                  <li className="flex items-center gap-2">
                    <Truck size={14} className="shrink-0 text-acid-2" aria-hidden /> 3–5 day US
                    delivery, reprint guarantee
                  </li>
                </ul>

                <p className="mt-5 border-t hairline pt-4 text-[11px] leading-relaxed text-ink/40">
                  Every price is recalculated on our server when the order is placed — the total you
                  are charged is the one you see here.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function CartLineCard({ line }: { line: ResolvedLine }) {
  const setSizes = useCart((s) => s.setSizes);
  const setMethod = useCart((s) => s.setMethod);
  const setColor = useCart((s) => s.setColor);
  const remove = useCart((s) => s.remove);

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      data-testid="cart-page-line"
      className="overflow-hidden rounded-3xl border hairline bg-paper p-5"
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <LineThumb line={line} className="h-40 w-32 shrink-0 self-center sm:self-start" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/products/${line.product.slug}`}
                className="display text-[22px] hover:text-acid-2"
              >
                {line.product.name}
              </Link>
              <p className="mt-1 text-[12px] text-ink/45">{line.product.fabric}</p>
              {line.design && (
                <Link
                  href={`/design?product=${line.product.slug}&color=${line.colorSlug}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink/55 transition hover:bg-paper-3 hover:text-ink"
                >
                  <PenLine size={11} aria-hidden />
                  Custom artwork · {line.design.sides?.join(" + ") ?? "front"}
                </Link>
              )}
            </div>
            <button
              onClick={() => remove(line.id)}
              aria-label={`Remove ${line.product.name} from the cart`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border hairline text-ink/40 transition hover:border-flame hover:text-flame"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">
                Colour — {line.color.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {line.product.colors.map((c) => {
                  const slug = colorSlug(c);
                  return (
                    <button
                      key={slug}
                      onClick={() => setColor(line.id, slug)}
                      aria-label={c.name}
                      aria-pressed={slug === line.colorSlug}
                      title={c.name}
                      className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                        slug === line.colorSlug ? "border-acid-2" : "border-ink/15"
                      }`}
                      style={{ background: c.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">
                Print method
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {line.product.method.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(line.id, m)}
                    aria-pressed={m === line.method}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                      m === line.method
                        ? "bg-ink text-paper"
                        : "border hairline text-ink/55 hover:text-ink"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">
            Sizes &amp; quantity
          </p>
          <div className="mt-2">
            <SizeGrid
              value={line.sizes}
              onChange={(next) => setSizes(line.id, next)}
              layout="dense"
              idPrefix={`cart-${line.id}`}
              sizes={sizesFor(line.product)}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t hairline pt-4">
            <div>
              <p className="text-[12px] text-ink/50">
                {line.quantity} × ${line.quote.baseUnitPrice.toFixed(2)}
                {line.quote.tier.off > 0 && (
                  <span className="ml-2 rounded-full bg-acid px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink">
                    {line.quote.tier.min}+ · {Math.round(line.quote.tier.off * 100)}% off
                  </span>
                )}
              </p>
              <TierHint product={line.product} quantity={line.quantity} className="mt-1.5" />
            </div>
            <p className="text-[20px] font-semibold tabular-nums">
              ${line.quote.subtotal.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "acid";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/50">{label}</dt>
      <dd className={`tabular-nums ${tone === "acid" ? "text-acid-2" : ""}`}>{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-paper-2 text-ink/25">
        <ShoppingBag size={30} />
      </span>
      <div>
        <p className="display text-[clamp(1.8rem,5vw,2.6rem)]">Your cart is empty</p>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-ink/50">
          Start from a blank or go straight into the studio — no minimums, and the per-unit price
          drops every time the count crosses a tier.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/design"
          className="rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink"
        >
          Open the studio
        </Link>
        <Link
          href="/products"
          className="rounded-full border hairline px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/70 hover:border-ink hover:text-ink"
        >
          Shop blanks
        </Link>
      </div>
    </div>
  );
}

/** The cart lives in localStorage, so the first paint has nothing to show yet —
 *  and flashing "your cart is empty" at someone who has ten shirts in it reads
 *  as data loss. */
function CartSkeleton() {
  return (
    <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] lg:gap-14">
      <ul className="space-y-5" aria-hidden>
        {[0, 1].map((i) => (
          <li key={i} className="flex gap-5 rounded-3xl border hairline p-5">
            <div className="h-40 w-32 shrink-0 animate-pulse rounded-xl bg-paper-2" />
            <div className="flex-1 space-y-3 py-2">
              <div className="h-5 w-1/2 animate-pulse rounded bg-paper-2" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-paper-2" />
              <div className="h-16 w-full animate-pulse rounded bg-paper-2" />
            </div>
          </li>
        ))}
      </ul>
      <div className="h-72 animate-pulse rounded-3xl bg-paper-2" aria-hidden />
      <span className="sr-only">Loading your cart…</span>
    </div>
  );
}
