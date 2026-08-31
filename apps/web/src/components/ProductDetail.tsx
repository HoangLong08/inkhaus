"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Ruler, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import ProductMedia from "@/components/ProductMedia";
import ProductGallery from "@/components/products/ProductGallery";
import StickyAddToCart from "@/components/products/StickyAddToCart";
import SizeGrid from "@/components/cart/SizeGrid";
import { FreeShippingMeter, TierHint } from "@/components/cart/Meters";
import { colorSlug, useCart } from "@/lib/cart";
import { heroImage } from "@/lib/productImages";
import {
  FREE_SHIPPING_OVER,
  PRODUCTS,
  TIERS,
  getProduct,
  quote,
  sizesFor,
  unitPrice,
} from "@/lib/catalog";

export default function ProductDetail({ slug }: { slug: string }) {
  const product = getProduct(slug)!;
  const add = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);
  const lines = useCart((s) => s.lines);

  const run = sizesFor(product);
  // M for apparel, but a one-size blank has no M to start on
  const defaultSize = run.includes("M") ? "M" : run[0];

  const [ci, setCi] = useState(0);
  const [method, setMethod] = useState(product.method[0]);
  const [sizes, setSizes] = useState<Record<string, number>>({ [defaultSize]: 1 });
  const [justAdded, setJustAdded] = useState(false);

  const color = product.colors[ci];
  const slugOfColor = colorSlug(color);

  const entries = useMemo(
    () =>
      Object.entries(sizes)
        .filter(([, qty]) => qty > 0)
        .map(([size, qty]) => ({ size, qty })),
    [sizes],
  );
  const totalQty = entries.reduce((n, e) => n + e.qty, 0);
  const priced = useMemo(() => quote(product, entries), [product, entries]);

  /** what this exact variant already has waiting in the cart */
  const inCart = useMemo(() => {
    const line = lines.find(
      (l) => l.id === `p:${product.slug}:${slugOfColor}:${method}`,
    );
    return line ? Object.values(line.sizes).reduce((a, b) => a + b, 0) : 0;
  }, [lines, product.slug, slugOfColor, method]);

  // same aisle first — a mug next to a mug is a better suggestion than a mug
  // next to whatever happens to be first in the catalog
  const others = useMemo(() => {
    const rest = PRODUCTS.filter((p) => p.slug !== slug);
    const near = rest.filter((p) => p.category === product.category);
    return [...near, ...rest.filter((p) => p.category !== product.category)].slice(0, 3);
  }, [slug, product.category]);

  const addButton = useRef<HTMLButtonElement>(null);

  /** top the run up to a tier minimum — the extra units land on the default size */
  const jumpTo = (min: number) => {
    const diff = min - totalQty;
    if (diff <= 0) return;
    setSizes((s) => ({ ...s, [defaultSize]: (s[defaultSize] ?? 0) + diff }));
  };

  const addToCart = () => {
    if (totalQty === 0) return;
    add({ productSlug: product.slug, colorSlug: slugOfColor, method, sizes });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2400);
    openDrawer();
  };

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge grid gap-12 pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* visual */}
        <div className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:h-fit">
          <ProductGallery product={product} color={color} colorKey={slugOfColor} />

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

          <p className="mt-9 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
            Print method
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.method.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                aria-pressed={m === method}
                className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                  m === method
                    ? "bg-ink text-paper"
                    : "bg-paper-2 text-ink/60 hover:bg-paper-3 hover:text-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
            Color — {color.name}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.colors.map((c, i) => (
              <button
                key={c.name}
                onClick={() => setCi(i)}
                aria-label={c.name}
                aria-pressed={i === ci}
                className={`h-10 w-10 rounded-full border-2 transition hover:scale-105 ${
                  i === ci ? "border-acid-2" : "border-ink/15"
                }`}
                style={{ background: c.hex }}
              />
            ))}
          </div>

          <div className="mt-8 flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
              Sizes &amp; quantity
            </p>
            {totalQty > 0 && (
              <button
                onClick={() => setSizes({})}
                className="text-[11px] uppercase tracking-[0.12em] text-ink/35 hover:text-flame"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-3">
            <SizeGrid
              value={sizes}
              onChange={setSizes}
              idPrefix={`pdp-${product.slug}`}
              sizes={run}
            />
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink/40">
            Mix sizes freely — the volume discount is earned on the total, so 6 × M and 6 × L reach
            the 12+ tier together.
          </p>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
            Jump to a tier
          </p>
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {TIERS.map((t) => {
              const active = priced.tier.min === t.min && totalQty > 0;
              return (
                <button
                  key={t.min}
                  onClick={() => jumpTo(t.min)}
                  disabled={totalQty >= t.min}
                  title={
                    totalQty >= t.min
                      ? `Already at the ${t.min}+ tier`
                      : `Top the run up to ${t.min} pieces`
                  }
                  className={`rounded-xl border px-2 py-3 text-center transition disabled:cursor-default ${
                    active
                      ? "border-acid-2 bg-acid/15"
                      : "hairline hover:bg-paper-3 disabled:opacity-45 disabled:hover:bg-transparent"
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{t.min}+</span>
                  <span className="block text-[10px] text-ink/40">
                    ${unitPrice(product, t.min).toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* price + add */}
          <div className="mt-9 rounded-3xl border hairline bg-paper-2 p-6">
            <div
              className="flex flex-wrap items-end justify-between gap-4"
              data-testid="pdp-price"
              data-unit={priced.baseUnitPrice.toFixed(2)}
              data-subtotal={priced.subtotal.toFixed(2)}
              data-quantity={totalQty}
            >
              <div>
                <p className="display text-[clamp(2.2rem,5.5vw,3.2rem)] leading-none">
                  ${priced.baseUnitPrice.toFixed(2)}
                  <span className="ml-2 text-[13px] font-normal tracking-normal text-ink/40">
                    / unit
                  </span>
                </p>
                <p className="mt-2 text-[12px] text-ink/50">
                  {totalQty === 0 ? (
                    "Add a size to price the run"
                  ) : (
                    <>
                      {totalQty} {totalQty === 1 ? "piece" : "pieces"} · subtotal{" "}
                      <b className="text-ink">${priced.subtotal.toFixed(2)}</b>
                      {priced.savings > 0 && (
                        <span className="text-acid-2"> · saving ${priced.savings.toFixed(2)}</span>
                      )}
                    </>
                  )}
                </p>
              </div>
              {priced.tier.off > 0 && (
                <span className="rounded-full bg-acid px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                  {priced.tier.min}+ tier · {Math.round(priced.tier.off * 100)}% off
                </span>
              )}
            </div>

            <TierHint product={product} quantity={totalQty} className="mt-3" />

            <div className="mt-5">
              <FreeShippingMeter subtotal={priced.subtotal} />
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                ref={addButton}
                onClick={addToCart}
                disabled={totalQty === 0}
                data-testid="pdp-add-to-cart"
                className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-acid disabled:hover:text-ink"
              >
                {justAdded ? <Check size={16} /> : <ShoppingBag size={16} />}
                {justAdded ? "Added to cart" : "Add to cart"}
              </button>
              <Link
                href={`/design?product=${product.slug}&color=${slugOfColor}`}
                className="group flex items-center justify-center gap-2 rounded-full border hairline px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/75 transition hover:border-ink hover:text-ink"
              >
                Put art on it
                <ArrowUpRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            </div>

            <p className="mt-3 text-center text-[11px] text-ink/40">
              {inCart > 0 ? (
                <>
                  {inCart} already in your cart in {color.name} ·{" "}
                  <Link href="/cart" className="text-acid-2 hover:underline">
                    view cart
                  </Link>
                </>
              ) : (
                <>Free digital proof in 2 hours · nothing is charged until you approve it</>
              )}
            </p>
          </div>

          <dl className="mt-10 space-y-3 border-t hairline pt-7 text-[13px]">
            {[
              ["Fabric", product.fabric],
              ["Print methods", product.method.join(" · ")],
              ["Max print size", `${product.printInches.w}" × ${product.printInches.h}"`],
              ["Minimum order", "1 piece"],
              ["Free shipping", `Orders over $${FREE_SHIPPING_OVER}`],
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
              <ProductMedia
                image={heroImage(p, colorSlug(p.colors[0]))}
                type={p.type}
                color={p.colors[0].hex}
                sizes="(min-width: 640px) 30vw, 90vw"
                className="w-full transition-transform duration-700 group-hover:scale-105"
              />
              <p className="mt-3 text-[15px] font-semibold">{p.name}</p>
              <p className="text-[12px] text-ink/40">from ${p.bulkPrice}</p>
            </Link>
          ))}
        </div>
      </section>

      <StickyAddToCart
        unitPrice={priced.baseUnitPrice}
        quantity={totalQty}
        subtotal={priced.subtotal}
        disabled={totalQty === 0}
        onAdd={addToCart}
        watch={addButton}
      />
    </div>
  );
}
