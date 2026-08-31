import type { Metadata } from "next";
import { Suspense } from "react";
import ProductBrowser from "@/components/products/ProductBrowser";
import { PRODUCTS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Blanks — INKHAUS",
  description:
    "Apparel, headwear, drinkware and homeware we actually stand behind. One piece or a thousand, same price ladder.",
};

export default function ProductsPage() {
  return (
    <div className="pt-[calc(var(--nav-h)+60px)]">
      <header className="edge pb-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">The catalog</p>
        <h1 className="display mt-5 text-[clamp(3rem,11vw,9rem)] leading-[0.85]">
          {PRODUCTS.length} blanks.
          <br />
          <span className="stroke-text">Zero filler.</span>
        </h1>
        <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink/55">
          We stock what prints well and lasts fifty washes. Every piece below can be printed one at a
          time or a thousand at a time — same price ladder, same presses.
        </p>
      </header>

      {/*
        ProductBrowser reads useSearchParams. Without this boundary the whole
        route would opt out of static rendering, and /products is one of the
        pages the service worker precaches.
      */}
      <Suspense fallback={<div className="edge py-24 text-[13px] text-ink/40">Loading blanks…</div>}>
        <ProductBrowser />
      </Suspense>
    </div>
  );
}
