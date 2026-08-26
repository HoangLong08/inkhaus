"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Garment from "@/components/Garment";
import { Reveal } from "@/components/Reveal";
import { PRODUCTS, type Product } from "@/lib/catalog";

function Tile({ p, i }: { p: Product; i: number }) {
  const [ci, setCi] = useState(0);
  return (
    <Reveal delay={(i % 3) * 0.07}>
      <article className="group relative">
        <Link
          href={`/products/${p.slug}`}
          className="relative block overflow-hidden rounded-3xl border hairline bg-paper-2 transition-colors duration-500 hover:bg-paper-3"
        >
          {p.tag && (
            <span className="absolute left-5 top-5 z-10 rounded-full bg-acid px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ink">
              {p.tag}
            </span>
          )}
          <Garment
            type={p.type}
            color={p.colors[ci].hex}
            className="w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
          />
          <span className="absolute bottom-5 right-5 grid h-12 w-12 translate-y-3 place-items-center rounded-full bg-acid text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight size={18} />
          </span>
        </Link>

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
            {p.colors[ci].name}
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
    </Reveal>
  );
}

export default function ProductGrid() {
  return (
    <div className="edge grid gap-x-6 gap-y-16 py-16 md:grid-cols-2 lg:grid-cols-3">
      {PRODUCTS.map((p, i) => (
        <Tile key={p.slug} p={p} i={i} />
      ))}
    </div>
  );
}
