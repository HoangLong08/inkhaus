"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Eye } from "lucide-react";
import ProductMedia from "@/components/ProductMedia";
import { Reveal } from "@/components/Reveal";
import { colorSlug } from "@/lib/cart";
import type { Product } from "@/lib/catalog";
import { heroImage } from "@/lib/productImages";

/**
 * The one product card. Used by /products, the homepage featured grid, the
 * homepage rail and the "goes well with" row, so a change to how a blank is
 * presented happens once rather than in four near-identical copies.
 *
 * The colourway swatches retint on hover as well as on click — on a grid, the
 * hover is the whole point, and the click is there for touch.
 */
export default function ProductCard({
  p,
  i = 0,
  onQuickView,
  reveal = true,
  preload = false,
}: {
  p: Product;
  i?: number;
  /** renders the hover quick-view button when provided */
  onQuickView?: (p: Product) => void;
  reveal?: boolean;
  preload?: boolean;
}) {
  const [ci, setCi] = useState(0);
  const color = p.colors[Math.min(ci, p.colors.length - 1)];
  const photo = heroImage(p, colorSlug(color));

  const card = (
    <article className="group relative" data-testid="product-card" data-slug={p.slug}>
      <Link
        href={`/products/${p.slug}`}
        className="relative block overflow-hidden rounded-3xl border hairline bg-paper-2 transition-colors duration-500 hover:bg-paper-3"
      >
        {p.tag && (
          <span className="absolute left-5 top-5 z-10 rounded-full bg-acid px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ink">
            {p.tag}
          </span>
        )}
        <ProductMedia
          image={photo}
          type={p.type}
          color={color.hex}
          preload={preload}
          className="w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
        />
        <span className="absolute bottom-5 right-5 grid h-12 w-12 translate-y-3 place-items-center rounded-full bg-acid text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight size={18} />
        </span>
      </Link>

      {/* A hover affordance, so pointer-only. Touch users get the full page. */}
      {onQuickView && (
        <button
          type="button"
          data-testid="quick-view-open"
          onClick={() => onQuickView(p)}
          className="absolute bottom-5 left-5 z-10 hidden items-center gap-2 rounded-full border hairline bg-paper/90 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink opacity-0 backdrop-blur transition-all duration-500 hover:bg-paper group-hover:opacity-100 lg:flex"
        >
          <Eye size={14} /> Quick view
        </button>
      )}

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">{p.name}</h2>
          <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-ink/40">{p.fabric}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-semibold">${p.price}</p>
          <p className="text-[11px] text-ink/40">${p.bulkPrice} at 50+</p>
        </div>
      </div>

      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink/45">{p.blurb}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {p.colors.map((c, idx) => (
          <button
            key={c.name}
            onMouseEnter={() => setCi(idx)}
            onClick={() => setCi(idx)}
            aria-label={c.name}
            className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
              idx === ci ? "border-acid-2" : "border-ink/20"
            }`}
            style={{ background: c.hex }}
          />
        ))}
        <span className="ml-1 text-[11px] uppercase tracking-[0.12em] text-ink/35">
          {color.name}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.method.map((m) => (
          <span
            key={m}
            className="rounded-full border hairline px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-ink/45"
          >
            {m}
          </span>
        ))}
      </div>
    </article>
  );

  // the filtered grid re-keys on every query change, and a reveal that replays
  // on each keystroke reads as flicker rather than as motion
  return reveal ? <Reveal delay={(i % 3) * 0.07}>{card}</Reveal> : card;
}
