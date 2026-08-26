"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, MousePointerClick } from "lucide-react";
import Garment from "@/components/Garment";
import Magnetic from "@/components/Magnetic";
import { COLORS } from "@/lib/catalog";

const SWATCHES = [COLORS.bone, COLORS.black, COLORS.acid, COLORS.forest, COLORS.flame, COLORS.navy];
const EASE = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  const [color, setColor] = useState(SWATCHES[0]);

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pb-16 pt-[calc(var(--nav-h)+70px)]">
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[38%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/30 blur-[140px]" />
        <div className="absolute right-[8%] top-[12%] h-[36vmin] w-[36vmin] rounded-full bg-flame/20 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #16171b 1px, transparent 1px), linear-gradient(to bottom, #16171b 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse at 50% 40%, #000 20%, transparent 72%)",
          }}
        />
      </div>

      {/* oversized ghost headline */}
      <motion.h1
        aria-hidden
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: EASE }}
        className="display pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center text-[clamp(5rem,18vw,15rem)] leading-[0.8] text-ink/[0.06]"
      >
        WEAR
        <br />
        YOUR IDEA
      </motion.h1>

      <div className="edge relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_auto] lg:items-center">
        {/* left copy */}
        <div className="relative z-10 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            className="inline-flex items-center gap-2 rounded-full border hairline px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/60"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acid" />
            2 printhouses · Los Angeles + Charlotte
          </motion.div>

          <h2 className="display mt-6 text-[clamp(2.8rem,7vw,5.2rem)]">
            {["Design it.", "We print it."].map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span
                  className="block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.09 }}
                >
                  {i === 1 ? (
                    <>
                      We <span className="text-acid-2">print</span> it.
                    </>
                  ) : (
                    line
                  )}
                </motion.span>
              </span>
            ))}
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
            className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink/60"
          >
            Drop your artwork into our studio, or start from 4,000+ pieces of clip art. One shirt or
            one thousand — no minimums, no setup fees, printed and shipped from the USA in{" "}
            <span className="text-ink">3–5 days</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Magnetic>
              <Link
                href="/design"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition-colors duration-500 hover:text-paper"
              >
                <span className="relative z-10">Start designing</span>
                <ArrowUpRight size={16} className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                <span className="absolute inset-0 translate-y-full bg-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
              </Link>
            </Magnetic>
            <Link
              href="/products"
              className="rounded-full border hairline px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/80 transition hover:border-ink hover:text-ink"
            >
              Browse blanks
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="mt-10 flex items-center gap-6 text-[11px] uppercase tracking-[0.16em] text-ink/40"
          >
            <span>★★★★★ 4.9 / 12,480 orders</span>
            <span className="hidden sm:inline">Reprint guarantee</span>
          </motion.div>
        </div>

        {/* garment */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
          className="relative z-10 mx-auto w-full max-w-[520px]"
        >
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <Garment
              type="tee"
              color={color.hex}
              printArea={{ x: 204, y: 242, w: 192, h: 256 }}
              className="w-full drop-shadow-[0_34px_64px_rgba(22,23,27,0.20)]"
            >
              <g fill={color.dark ? "#F4F1E9" : "#151517"}>
                <text
                  x="300"
                  y="330"
                  textAnchor="middle"
                  fontFamily="var(--font-anton), Arial Black"
                  fontSize="62"
                  letterSpacing="2"
                >
                  YOUR
                </text>
                <text
                  x="300"
                  y="390"
                  textAnchor="middle"
                  fontFamily="var(--font-anton), Arial Black"
                  fontSize="62"
                  letterSpacing="2"
                >
                  IDEA
                </text>
                <text
                  x="300"
                  y="436"
                  textAnchor="middle"
                  fontFamily="var(--font-instrument), Georgia"
                  fontStyle="italic"
                  fontSize="30"
                  opacity="0.75"
                >
                  goes right here
                </text>
                <rect x="238" y="454" width="124" height="4" opacity="0.5" />
              </g>
            </Garment>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1, duration: 0.7, ease: EASE }}
            className="absolute -right-2 top-6 rotate-6 rounded-lg border hairline bg-paper/90 px-3 py-2 text-[10px] uppercase tracking-[0.16em] backdrop-blur"
          >
            <span className="text-acid-2">DTG</span> · 300 dpi · 12×16&quot;
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.25, duration: 0.7, ease: EASE }}
            className="absolute -left-3 bottom-16 -rotate-6 rounded-lg border hairline bg-paper/90 px-3 py-2 text-[10px] uppercase tracking-[0.16em] backdrop-blur"
          >
            $11.40 <span className="text-ink/40">/ unit at 50+</span>
          </motion.div>
        </motion.div>

        {/* swatches */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.8 }}
          className="relative z-10 mb-10 flex items-center gap-3 lg:mb-0 lg:flex-col"
        >
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-ink/35 lg:block [writing-mode:vertical-rl]">
            Try a color
          </span>
          {SWATCHES.map((c) => (
            <button
              key={c.name}
              onClick={() => setColor(c)}
              aria-label={c.name}
              className={`h-8 w-8 rounded-full border-2 transition-transform duration-300 hover:scale-110 ${
                color.hex === c.hex ? "border-acid-2 scale-110" : "border-ink/20"
              }`}
              style={{ background: c.hex }}
            />
          ))}
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-ink/35 lg:hidden">
            <MousePointerClick size={12} /> tap
          </span>
        </motion.div>
      </div>

      <div className="edge absolute inset-x-0 bottom-6 hidden items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink/30 md:flex">
        <span>Scroll to explore</span>
        <span>Est. 2026 — Made in USA</span>
      </div>
    </section>
  );
}
