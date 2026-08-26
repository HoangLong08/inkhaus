"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Truck, ShieldCheck, Ruler } from "lucide-react";
import Garment from "@/components/Garment";
import { FREE_SHIPPING_OVER, PRODUCTS, SIZES, TIERS, getProduct, unitPrice } from "@/lib/catalog";

export default function ProductDetail({ slug }: { slug: string }) {
  const product = getProduct(slug)!;
  const [ci, setCi] = useState(0);
  const [qty, setQty] = useState(12);
  const [size, setSize] = useState<string>("M");
  const color = product.colors[ci];

  const unit = useMemo(() => unitPrice(product, qty), [product, qty]);
  const others = PRODUCTS.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge grid gap-12 pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* visual */}
        <div className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:h-fit">
          <div className="relative overflow-hidden rounded-3xl border hairline bg-[radial-gradient(ellipse_at_50%_0%,#ffffff,#eceee7)] p-6">
            <motion.div
              key={color.hex}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Garment
                type={product.type}
                color={color.hex}
                printArea={product.printArea}
                showPrintGuide
                className="w-full drop-shadow-[0_24px_48px_rgba(22,23,27,0.18)]"
              />
            </motion.div>
            <span className="absolute bottom-6 left-6 rounded-full border hairline bg-paper/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-ink/60 backdrop-blur">
              Print area {product.printInches.w}&quot; × {product.printInches.h}&quot;
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-[11px] uppercase tracking-[0.12em] text-ink/45">
            <span className="flex items-center gap-2 rounded-xl border hairline px-3 py-3">
              <Truck size={14} className="text-acid-2" /> 3–5 days
            </span>
            <span className="flex items-center gap-2 rounded-xl border hairline px-3 py-3">
              <ShieldCheck size={14} className="text-acid-2" /> Reprint free
            </span>
            <span className="flex items-center gap-2 rounded-xl border hairline px-3 py-3">
              <Ruler size={14} className="text-acid-2" /> True to size
            </span>
          </div>
        </div>

        {/* info */}
        <div>
          <nav className="text-[11px] uppercase tracking-[0.16em] text-ink/35">
            <Link href="/products" className="hover:text-ink">Blanks</Link> / {product.name}
          </nav>

          <h1 className="display mt-5 text-[clamp(2.6rem,7vw,4.6rem)]">{product.name}</h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink/55">{product.blurb}</p>

          <div className="mt-7 flex flex-wrap gap-1.5">
            {product.method.map((m) => (
              <span key={m} className="rounded-full bg-paper-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-ink/60">
                {m}
              </span>
            ))}
          </div>

          <p className="mt-9 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
            Color — {color.name}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.colors.map((c, i) => (
              <button
                key={c.name}
                onClick={() => setCi(i)}
                aria-label={c.name}
                className={`h-10 w-10 rounded-full border-2 transition hover:scale-105 ${
                  i === ci ? "border-acid-2" : "border-ink/15"
                }`}
                style={{ background: c.hex }}
              />
            ))}
          </div>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">Size</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`min-w-[54px] rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                  size === s ? "border-acid-2 bg-acid text-ink" : "hairline hover:bg-paper-3"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
            Quantity — price drops as you go
          </p>
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {TIERS.map((t) => (
              <button
                key={t.min}
                onClick={() => setQty(t.min)}
                className={`rounded-xl border px-2 py-3 text-center transition ${
                  qty === t.min ? "border-acid-2 bg-paper-2" : "hairline hover:bg-paper-3"
                }`}
              >
                <span className="block text-[13px] font-semibold">{t.min}+</span>
                <span className="block text-[10px] text-ink/40">
                  ${unitPrice(product, t.min).toFixed(2)}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-t hairline pt-7">
            <div>
              <p className="display text-[clamp(2.4rem,6vw,3.6rem)] leading-none">
                ${unit.toFixed(2)}
                <span className="ml-2 text-[14px] font-normal tracking-normal text-ink/40">/ unit</span>
              </p>
              <p className="mt-2 text-[12px] text-ink/45">
                {qty} × {size} · total{" "}
                <b className="text-ink">${(unit * qty).toFixed(2)}</b>{" "}
                {unit * qty >= FREE_SHIPPING_OVER && (
                  <span className="text-acid-2">· free shipping</span>
                )}
              </p>
            </div>
            <Link
              href="/design"
              className="group inline-flex items-center gap-2 rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink"
            >
              Design this
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <dl className="mt-10 space-y-3 border-t hairline pt-7 text-[13px]">
            {[
              ["Fabric", product.fabric],
              ["Print methods", product.method.join(" · ")],
              ["Max print size", `${product.printInches.w}" × ${product.printInches.h}"`],
              ["Minimum order", "1 piece"],
              ["Turnaround", "2h proof · 3–5 day US delivery"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6">
                <dt className="text-ink/40">{k}</dt>
                <dd className="text-right text-ink/80">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* related */}
      <section className="edge border-t hairline py-16">
        <h2 className="display text-[clamp(1.8rem,4vw,3rem)]">Goes well with</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {others.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="group rounded-2xl border hairline bg-paper-2 p-4 transition hover:bg-paper-3"
            >
              <Garment
                type={p.type}
                color={p.colors[0].hex}
                className="w-full transition-transform duration-700 group-hover:scale-105"
              />
              <p className="mt-3 text-[15px] font-semibold">{p.name}</p>
              <p className="text-[12px] text-ink/40">from ${p.bulkPrice}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
