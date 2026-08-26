"use client";

import { Reveal, RevealWords } from "@/components/Reveal";
import { Upload, Sparkles, Layers3, Truck, ShieldCheck, Palette } from "lucide-react";

const CARDS = [
  {
    icon: Upload,
    title: "Upload anything",
    body: "PNG, JPG, SVG, AI, PSD or PDF. We auto-check resolution, strip the background and warn you before it ever hits a press.",
    span: "md:col-span-2",
    accent: true,
  },
  {
    icon: Sparkles,
    title: "Or generate it",
    body: "Describe the shirt you want. Our AI drafts print-ready vector art in seconds.",
    span: "",
  },
  {
    icon: Palette,
    title: "4,200 clip arts",
    body: "Licensed graphics, 180 fonts, curved text, distress and puff effects.",
    span: "",
  },
  {
    icon: Layers3,
    title: "Front, back, sleeves & inside label",
    body: "Every print location in one canvas. Switch sides without losing your layers.",
    span: "md:col-span-2",
  },
  {
    icon: Truck,
    title: "3–5 day US delivery",
    body: "Printed in LA or Charlotte — whichever is closer to your customer.",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Reprint guarantee — no arguing",
    body: "Colors off? Sizing wrong? We reprint free, no return needed, and we tell you the new ship date the same day.",
    span: "md:col-span-2",
  },
];

export default function Steps() {
  return (
    <section className="edge relative border-t hairline py-20 md:py-28">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h2 className="display max-w-2xl text-[clamp(2.4rem,6vw,5rem)]">
          <RevealWords text="Everything a print shop" />
          <br />
          <RevealWords text="should have been" delay={0.12} />
          <span className="text-acid-2">.</span>
        </h2>
        <Reveal delay={0.2}>
          <p className="max-w-xs text-sm leading-relaxed text-ink/50">
            Built by people who actually run the presses. Every feature exists because a customer
            asked for it at 2am the night before a deadline.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-3 md:grid-cols-3">
        {CARDS.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.06} className={c.span}>
            <div
              className={`group relative h-full overflow-hidden rounded-2xl border hairline p-7 transition-colors duration-500 ${
                c.accent ? "noise-card bg-paper-2" : "bg-paper-2 hover:bg-paper-3"
              }`}
            >
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-acid/0 blur-3xl transition-all duration-700 group-hover:bg-acid/40" />
              <c.icon size={22} className="relative text-acid-2" />
              <h3 className="relative mt-8 text-[19px] font-semibold tracking-tight">{c.title}</h3>
              <p className="relative mt-2.5 max-w-md text-[14px] leading-relaxed text-ink/50">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
