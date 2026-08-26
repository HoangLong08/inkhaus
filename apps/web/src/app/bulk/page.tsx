import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, RevealWords } from "@/components/Reveal";
import BulkCalculator from "@/components/home/BulkCalculator";

export const metadata: Metadata = {
  title: "Teams & Bulk Orders — INKHAUS",
  description: "Group orders, size distribution, name & number printing, invoicing and net terms.",
};

const FEATURES = [
  ["Size distribution grid", "Type quantities per size in one screen instead of adding a product to cart seven times."],
  ["Names & numbers", "Upload a roster CSV, we print each shirt individually. $4 per garment, no setup fee."],
  ["Group order links", "Share one link, everyone picks their own size and pays their own share. You never chase Venmo again."],
  ["Free digital proof", "A real proof from our press operator within 2 hours, not an auto-generated mockup."],
  ["Net 30 for schools", "Purchase orders and W-9 available. Tax exemption certificates accepted."],
  ["Rush production", "Need it in 48 hours? We can, for +$3 per piece. Tell us the event date."],
];

export default function BulkPage() {
  return (
    <div className="pt-[calc(var(--nav-h)+60px)]">
      <header className="edge pb-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">Teams · Schools · Events</p>
        <h1 className="display mt-5 text-[clamp(3rem,10vw,8rem)] leading-[0.85]">
          <RevealWords text="Order for" />
          <br />
          <RevealWords text="everyone" delay={0.1} />
          <span className="text-acid-2">.</span>
        </h1>
        <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink/55">
          Built for the person stuck organising 60 shirts in a group chat. One link, one invoice, one
          delivery date you can actually promise.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/design" className="rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
            Start a group order
          </Link>
          <a href="mailto:quotes@inkhaus.example" className="rounded-full border hairline px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/80 hover:border-ink hover:text-ink">
            Request a quote
          </a>
        </div>
      </header>

      <section className="edge grid gap-3 border-t hairline py-16 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([t, b], i) => (
          <Reveal key={t} delay={(i % 3) * 0.07}>
            <div className="h-full rounded-2xl border hairline bg-paper-2 p-7 transition hover:bg-paper-3">
              <p className="display text-[22px]">{t}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink/50">{b}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <BulkCalculator />
    </div>
  );
}
