"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProductMedia from "@/components/ProductMedia";
import { Reveal } from "@/components/Reveal";
import { colorSlug } from "@/lib/cart";
import { CATEGORY_LABEL, PRODUCTS, type ProductCategory } from "@/lib/catalog";
import { heroImage } from "@/lib/productImages";
import { activeCategories, countFor } from "@/lib/productFilter";

/** one line of copy per aisle — what the category is actually for */
const PITCH: Record<ProductCategory, string> = {
  apparel: "Tees, hoodies, crews. The reorder engine.",
  headwear: "Caps and beanies. Embroidery only.",
  bags: "Totes that survive a grocery run.",
  drinkware: "Mugs and tumblers. Sublimation and UV.",
  home: "Blankets, pillows, aprons, desk mats.",
  paper: "Posters, canvas, die-cut stickers.",
  tech: "Cases printed edge to edge.",
};

const CATS = activeCategories();

export default function Categories() {
  return (
    <section id="categories" data-testid="home-categories" className="edge border-t hairline py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">
            Shop by category
          </p>
          <h2 className="display mt-4 text-[clamp(2.2rem,6vw,4.5rem)]">
            Seven aisles.
            <br />
            <span className="stroke-text">One price ladder.</span>
          </h2>
        </div>
        <Link
          href="/products"
          className="link-underline flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink/60"
        >
          All {PRODUCTS.length} blanks <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATS.map((cat, i) => {
          // the flagship of the aisle — a tagged product if there is one, since
          // that is the merchandising signal already in the catalog
          const pick =
            PRODUCTS.find((p) => p.category === cat && p.tag) ??
            PRODUCTS.find((p) => p.category === cat)!;
          const n = countFor(PRODUCTS, cat);

          return (
            <Reveal key={cat} delay={(i % 4) * 0.06}>
              <Link
                href={`/products?cat=${cat}`}
                data-testid={`home-category-${cat}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border hairline bg-paper-2 transition-colors duration-500 hover:bg-paper-3"
              >
                <div className="relative overflow-hidden">
                  <ProductMedia
                    image={heroImage(pick, colorSlug(pick.colors[0]))}
                    type={pick.type}
                    color={pick.colors[0].hex}
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 92vw"
                    className="w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
                  />
                  <span className="absolute right-4 top-4 rounded-full border hairline bg-paper/80 px-2.5 py-1 text-[10px] font-bold tabular-nums text-ink/60 backdrop-blur">
                    {n}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-3 p-5 pt-4">
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">
                      {CATEGORY_LABEL[cat]}
                    </h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/45">{PITCH[cat]}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40 transition group-hover:text-acid-2">
                    Browse
                    <ArrowUpRight
                      size={13}
                      className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
