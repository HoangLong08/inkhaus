"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { FREE_SHIPPING_OVER, PRODUCTS, TIERS, unitPrice } from "@/lib/catalog";

export default function BulkCalculator() {
  const [slug, setSlug] = useState(PRODUCTS[0].slug);
  const [qty, setQty] = useState(24);
  const product = PRODUCTS.find((p) => p.slug === slug)!;

  const { unit, total, saved } = useMemo(() => {
    const unit = unitPrice(product, qty);
    const total = unit * qty;
    const saved = product.price * qty - total;
    return { unit, total, saved };
  }, [product, qty]);

  const activeTier = [...TIERS].reverse().find((t) => qty >= t.min) ?? TIERS[0];

  return (
    <section className="relative overflow-hidden border-t hairline bg-paper-2 text-ink">
      <div className="edge grid gap-14 py-20 md:py-28 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-flame">Teams · schools · events</p>
          <h2 className="display mt-4 text-[clamp(2.4rem,6.4vw,5.4rem)] text-ink">
            The more you
            <br />
            print, the less
            <br />
            it costs<span className="text-flame">.</span>
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink/60">
            No setup fees. No screen charges. No minimum. Move the slider and see the real number —
            that&apos;s the price you pay at checkout, printed and shipped.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {["Family reunions", "Bachelorette", "Startup swag", "Church groups", "Race day", "Band merch"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/60"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>

        <Reveal>
          <div className="rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] md:p-9">
            <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">Product</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRODUCTS.slice(0, 5).map((p) => (
                <button
                  key={p.slug}
                  onClick={() => setSlug(p.slug)}
                  className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                    slug === p.slug ? "bg-ink text-paper" : "bg-ink/[0.06] text-ink/70 hover:bg-ink/10"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-baseline justify-between">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">Quantity</label>
              <span className="display text-[34px] leading-none">{qty}</span>
            </div>
            <input
              type="range"
              min={1}
              max={300}
              value={qty}
              onChange={(e) => setQty(+e.target.value)}
              className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink/15 accent-flame"
            />
            <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink/35">
              {[1, 12, 50, 100, 300].map((n) => (
                <button key={n} onClick={() => setQty(n)} className="hover:text-ink">
                  {n}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-ink/10 pt-7">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/40">Per unit</p>
                <p className="display mt-1.5 text-[clamp(1.6rem,3vw,2.2rem)]">${unit.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/40">Total</p>
                <p className="display mt-1.5 text-[clamp(1.6rem,3vw,2.2rem)]">${total.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/40">You save</p>
                <p className="display mt-1.5 text-[clamp(1.6rem,3vw,2.2rem)] text-flame">
                  ${saved.toFixed(0)}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-ink/[0.05] px-4 py-3 text-[12px] text-ink/60">
              Tier applied: <b className="text-ink">{activeTier.min}+ units</b> ·{" "}
              {Math.round(activeTier.off * 100)}% off · free US shipping{" "}
              {total >= FREE_SHIPPING_OVER
                ? "included"
                : `at $${FREE_SHIPPING_OVER} (add $${(FREE_SHIPPING_OVER - total).toFixed(0)})`}
            </div>

            <Link
              href="/design"
              className="mt-6 block rounded-full bg-ink py-4 text-center text-[13px] font-bold uppercase tracking-[0.14em] text-paper transition hover:bg-flame"
            >
              Design this order
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
