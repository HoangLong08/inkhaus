import type { Metadata } from "next";
import ProductGrid from "@/components/ProductGrid";

export const metadata: Metadata = {
  title: "Blanks — INKHAUS",
  description: "Eight blanks we actually stand behind. Heavyweight tees, fleece hoodies, headwear.",
};

export default function ProductsPage() {
  return (
    <div className="pt-[calc(var(--nav-h)+60px)]">
      <header className="edge border-b hairline pb-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">The catalog</p>
        <h1 className="display mt-5 text-[clamp(3rem,11vw,9rem)] leading-[0.85]">
          Eight blanks.
          <br />
          <span className="stroke-text">Zero filler.</span>
        </h1>
        <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink/55">
          We stock what prints well and lasts fifty washes. Every piece below can be printed one at a
          time or a thousand at a time — same price ladder, same presses.
        </p>
      </header>
      <ProductGrid />
    </div>
  );
}
