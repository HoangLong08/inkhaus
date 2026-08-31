"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProductCard from "@/components/products/ProductCard";
import { PRODUCTS } from "@/lib/catalog";

// Tagged blanks first — `tag` is the merchandising flag the catalog already
// carries ("Best seller", "Premium", "New") — then catalog order to fill out
// the row. Computed once at module scope: the catalog is static.
const FEATURED = [...PRODUCTS.filter((p) => p.tag), ...PRODUCTS.filter((p) => !p.tag)].slice(0, 6);

export default function FeaturedGrid() {
  return (
    <section data-testid="home-featured" className="edge border-t hairline py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">
            What people reorder
          </p>
          <h2 className="display mt-4 text-[clamp(2.2rem,6vw,4.5rem)]">The short list.</h2>
        </div>
        <Link
          href="/products"
          className="link-underline flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink/60"
        >
          See everything <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mt-12 grid gap-x-6 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
        {FEATURED.map((p, i) => (
          <ProductCard key={p.slug} p={p} i={i} />
        ))}
      </div>
    </section>
  );
}
