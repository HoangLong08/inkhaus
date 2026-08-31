"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ShoppingBag } from "lucide-react";
import ProductMedia from "@/components/ProductMedia";
import SizeGrid from "@/components/cart/SizeGrid";
import Modal from "@/components/ui/Modal";
import { colorSlug, useCart } from "@/lib/cart";
import { quote, sizesFor, type Product } from "@/lib/catalog";
import { heroImage } from "@/lib/productImages";

/**
 * Buying without leaving the grid.
 *
 * Deliberately a subset of the product page: colour, method, sizes, live price,
 * add to cart. Anything that needs reading — fabric spec, print area, the tier
 * ladder — is a link away rather than crammed in here.
 *
 * Its add-to-cart carries its own testid. The browser verification clicks the
 * *first* node matching a selector, so reusing `pdp-add-to-cart` here would make
 * that script click whichever happened to render first.
 */
export default function QuickView({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      label={product ? `${product.name} — quick view` : "Quick view"}
      testid="quick-view"
      className="max-w-4xl"
    >
      {product && <Body key={product.slug} product={product} onClose={onClose} />}
    </Modal>
  );
}

function Body({ product, onClose }: { product: Product; onClose: () => void }) {
  const add = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);

  const run = sizesFor(product);
  const defaultSize = run.includes("M") ? "M" : run[0];

  const [ci, setCi] = useState(0);
  const [method, setMethod] = useState(product.method[0]);
  const [sizes, setSizes] = useState<Record<string, number>>({ [defaultSize]: 1 });
  const [added, setAdded] = useState(false);

  const color = product.colors[ci];
  const photo = heroImage(product, colorSlug(color));

  const entries = useMemo(
    () =>
      Object.entries(sizes)
        .filter(([, q]) => q > 0)
        .map(([size, qty]) => ({ size, qty })),
    [sizes],
  );
  const totalQty = entries.reduce((n, e) => n + e.qty, 0);
  const priced = useMemo(() => quote(product, entries), [product, entries]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(t);
  }, [added]);

  const addToCart = () => {
    if (totalQty === 0) return;
    add({ productSlug: product.slug, colorSlug: colorSlug(color), method, sizes });
    setAdded(true);
    onClose();
    openDrawer();
  };

  return (
    <div className="grid gap-6 p-6 sm:grid-cols-2 sm:gap-8 sm:p-8">
      <div className="overflow-hidden rounded-2xl border hairline bg-[radial-gradient(ellipse_at_50%_0%,#ffffff,#eceee7)] p-4">
        <ProductMedia
          image={photo}
          type={product.type}
          color={color.hex}
          sizes="(min-width: 640px) 40vw, 90vw"
          className="w-full"
        />
      </div>

      <div className="min-w-0">
        <h2 className="display pr-10 text-[clamp(1.6rem,4vw,2.4rem)]">{product.name}</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-ink/50">{product.blurb}</p>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
          Method
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.method.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={m === method}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                m === method
                  ? "bg-ink text-paper"
                  : "bg-paper-2 text-ink/60 hover:bg-paper-3 hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
          Colour — {color.name}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {product.colors.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setCi(i)}
              aria-label={c.name}
              aria-pressed={i === ci}
              className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${
                i === ci ? "border-acid-2" : "border-ink/15"
              }`}
              style={{ background: c.hex }}
            />
          ))}
        </div>

        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
          Sizes &amp; quantity
        </p>
        <div className="mt-2">
          <SizeGrid
            value={sizes}
            onChange={setSizes}
            layout="dense"
            idPrefix={`qv-${product.slug}`}
            sizes={run}
          />
        </div>

        <div className="mt-6 flex items-end justify-between gap-4 border-t hairline pt-4">
          <div>
            <p className="text-[26px] font-semibold leading-none">
              ${priced.baseUnitPrice.toFixed(2)}
              <span className="ml-1 text-[11px] font-normal uppercase tracking-[0.12em] text-ink/40">
                / unit
              </span>
            </p>
            <p className="mt-1.5 text-[12px] text-ink/50">
              {totalQty} {totalQty === 1 ? "piece" : "pieces"} · subtotal $
              {priced.subtotal.toFixed(2)}
            </p>
          </div>
          <Link
            href={`/products/${product.slug}`}
            className="link-underline flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.12em] text-ink/60"
          >
            Full details <ArrowUpRight size={13} />
          </Link>
        </div>

        <button
          type="button"
          data-testid="quick-view-add-to-cart"
          onClick={addToCart}
          disabled={totalQty === 0}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check size={16} /> : <ShoppingBag size={16} />}
          {totalQty === 0 ? "Pick a quantity" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
