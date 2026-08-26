"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import Garment from "@/components/Garment";
import { Reveal } from "@/components/Reveal";
import { PRODUCTS } from "@/lib/catalog";

function Card({ index }: { index: number }) {
  const p = PRODUCTS[index];
  const [ci, setCi] = useState(0);
  const color = p.colors[ci];

  return (
    <div className="group relative flex w-[78vw] shrink-0 snap-start flex-col sm:w-[46vw] lg:w-[30vw] xl:w-[24vw]">
      <Link
        href={`/products/${p.slug}`}
        className="relative overflow-hidden rounded-2xl border hairline bg-paper-2 transition-colors duration-500 group-hover:bg-paper-3"
      >
        {p.tag && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-acid px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ink">
            {p.tag}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <Garment
          type={p.type}
          color={color.hex}
          className="w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
        <span className="absolute bottom-4 right-4 flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-acid text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowRight size={17} />
        </span>
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight">{p.name}</h3>
          <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-ink/40">{p.fabric}</p>
        </div>
        <div className="text-right">
          <p className="text-[16px] font-semibold">${p.price}</p>
          <p className="text-[11px] text-ink/40">${p.bulkPrice} at 50+</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.colors.map((c, i) => (
          <button
            key={c.name}
            onMouseEnter={() => setCi(i)}
            onClick={() => setCi(i)}
            aria-label={c.name}
            className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
              i === ci ? "border-acid-2" : "border-ink/20"
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProductRail() {
  return (
    <section className="relative border-t hairline py-20 md:py-28">
      <div className="edge flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">The blanks</p>
          <h2 className="display mt-4 text-[clamp(2.4rem,6vw,5rem)]">
            Good garments
            <br />
            first<span className="text-acid-2">.</span>
          </h2>
        </div>
        <Link
          href="/products"
          className="link-underline self-start text-[13px] font-bold uppercase tracking-[0.14em] text-ink/70 hover:text-ink md:self-auto"
        >
          All 8 blanks →
        </Link>
      </div>

      <Reveal>
        <div
          className="mt-12 flex snap-x gap-5 overflow-x-auto px-[clamp(1rem,4vw,4.5rem)] pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingLeft: "clamp(1rem, 4vw, 4.5rem)" }}
        >
          {PRODUCTS.map((_, i) => (
            <Card key={i} index={i} />
          ))}
          <div className="w-4 shrink-0" />
        </div>
      </Reveal>

      <p className="edge mt-2 text-[11px] uppercase tracking-[0.18em] text-ink/30">
        ← Drag / scroll sideways
      </p>
    </section>
  );
}
