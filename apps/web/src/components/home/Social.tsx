"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import Magnetic from "@/components/Magnetic";

const REVIEWS = [
  { q: "Uploaded our logo at 9pm, had a proof by 11pm, 60 hoodies landed Thursday.", a: "Marcus D.", r: "Ridgeline FC, Denver" },
  { q: "The design tool is the only one my mom could use without calling me.", a: "Priya S.", r: "Family reunion, Houston" },
  { q: "Cheaper than Custom Ink at 24 pieces and the print is thicker.", a: "Jordan L.", r: "Coffee shop, Portland" },
  { q: "Reprinted 8 shirts free when our sizing chart was wrong. No arguing.", a: "Elena V.", r: "Nonprofit, Miami" },
  { q: "Sleeve print included free sold me instantly.", a: "Tyler K.", r: "Skate brand, Phoenix" },
  { q: "Ordered one shirt for a gag gift. Same quality as our team order.", a: "Sam R.", r: "Brooklyn" },
];

const STATS = [
  ["12,480", "orders printed"],
  ["4.9/5", "average rating"],
  ["2 hrs", "average proof time"],
  ["3–5 days", "US delivery"],
];

export default function Social() {
  return (
    <>
      <section className="overflow-hidden border-t hairline py-16">
        <div className="edge grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map(([n, l], i) => (
            <Reveal key={l} delay={i * 0.07}>
              <p className="display text-[clamp(2.2rem,5vw,4rem)] text-acid-2">{n}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/40">{l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="marquee-pause overflow-hidden border-t hairline py-16">
        <div className="marquee-track gap-4" style={{ "--dur": "52s" } as React.CSSProperties}>
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 gap-4">
              {REVIEWS.map((rv) => (
                <figure
                  key={rv.a + k}
                  className="flex w-[300px] shrink-0 flex-col justify-between rounded-2xl border hairline bg-paper-2 p-6 md:w-[380px]"
                >
                  <p className="text-acid-2">★★★★★</p>
                  <blockquote className="mt-4 text-[16px] leading-snug text-ink/90">“{rv.q}”</blockquote>
                  <figcaption className="mt-6 text-[11px] uppercase tracking-[0.14em] text-ink/40">
                    {rv.a} — {rv.r}
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-t hairline">
        <div className="edge relative py-24 text-center md:py-36">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/35 blur-[130px]" />
          <h2 className="display relative text-[clamp(3rem,13vw,11rem)] leading-[0.82]">
            Ready when
            <br />
            <span className="stroke-text">you are</span>
            <span className="text-acid-2">.</span>
          </h2>
          <Reveal delay={0.15}>
            <div className="relative mt-12 flex flex-wrap items-center justify-center gap-3">
              <Magnetic strength={0.4}>
                <Link
                  href="/design"
                  className="group relative inline-flex overflow-hidden rounded-full bg-acid px-9 py-5 text-[13px] font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-500 hover:text-paper"
                >
                  <span className="relative z-10">Open the design studio</span>
                  <span className="absolute inset-0 translate-y-full bg-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
                </Link>
              </Magnetic>
              <Link
                href="/bulk"
                className="rounded-full border hairline px-9 py-5 text-[13px] font-bold uppercase tracking-[0.16em] text-ink/80 transition hover:border-ink hover:text-ink"
              >
                Get a bulk quote
              </Link>
            </div>
            <p className="relative mt-6 text-[11px] uppercase tracking-[0.18em] text-ink/35">
              No account needed · Free proof · Cancel before print
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
