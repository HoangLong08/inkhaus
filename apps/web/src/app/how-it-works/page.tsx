import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, RevealWords } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "How it works — INKHAUS",
  description: "From artwork to doorstep in five steps. Artwork specs, print methods, shipping and returns.",
};

const STEPS = [
  ["01", "Design or upload", "Use the studio, upload a finished file, or send us a napkin sketch — we redraw simple art free."],
  ["02", "We check the file", "A human checks resolution, colours and placement. If something will print badly, we tell you before charging you."],
  ["03", "Approve your proof", "You get a photo-real proof within 2 hours. Nothing prints until you hit approve."],
  ["04", "We print it", "DTG and DTF run daily in Los Angeles; screen printing and embroidery in Charlotte."],
  ["05", "It ships", "3–5 days anywhere in the US, 6–12 worldwide. Tracking the moment it leaves the floor."],
];

const METHODS = [
  ["DTG", "Direct to garment", "Unlimited colours, photographic detail, soft hand. Best for 1–50 pieces and complex artwork.", "1 piece"],
  ["Screen print", "Traditional plastisol", "Thickest, brightest, cheapest at volume. Priced per colour per location.", "12 pieces"],
  ["DTF", "Direct to film", "Works on poly, blends and dark colours. Great for jerseys and performance fabric.", "1 piece"],
  ["Embroidery", "Thread", "Caps, polos, fleece. Up to 12 thread colours, 15,000 stitches included.", "6 pieces"],
];

const SPECS = [
  ["Resolution", "300 DPI at full print size. We warn you below 150."],
  ["File types", "PNG, JPG, SVG, PDF, AI, PSD, TIFF up to 25 MB."],
  ["Colour mode", "Design in RGB — we convert and proof in CMYK for you."],
  ["Background", "Transparent PNG for DTG. We can remove backgrounds free."],
  ["Max print area", "12\" × 16\" on tees, 11\" × 11\" on hoodie fronts."],
  ["Copyright", "You must own or license the artwork. We reject infringing files and refund in full."],
];

export default function HowItWorksPage() {
  return (
    <div className="pt-[calc(var(--nav-h)+60px)]">
      <header className="edge pb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">The process</p>
        <h1 className="display mt-5 text-[clamp(3rem,10vw,8rem)] leading-[0.85]">
          <RevealWords text="Artwork to" />
          <br />
          <RevealWords text="doorstep" delay={0.1} />
          <span className="text-acid-2">.</span>
        </h1>
      </header>

      <section className="edge border-t hairline">
        {STEPS.map(([n, t, b], i) => (
          <Reveal key={n} delay={i * 0.05}>
            <div className="group grid gap-4 border-b hairline py-10 md:grid-cols-[100px_1fr_1.2fr] md:items-baseline">
              <span className="display text-[clamp(2rem,4vw,3rem)] text-ink/20 transition-colors duration-500 group-hover:text-acid-2">
                {n}
              </span>
              <h2 className="display text-[clamp(1.6rem,3.4vw,2.6rem)]">{t}</h2>
              <p className="max-w-md text-[15px] leading-relaxed text-ink/50">{b}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="edge py-20">
        <h2 className="display text-[clamp(2rem,5vw,3.6rem)]">Print methods</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {METHODS.map(([tag, name, body, min], i) => (
            <Reveal key={tag} delay={(i % 2) * 0.07}>
              <div className="h-full rounded-2xl border hairline bg-paper-2 p-7">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-acid px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                    {tag}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-ink/35">min {min}</span>
                </div>
                <p className="display mt-6 text-[24px]">{name}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/50">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="edge border-t hairline py-20">
        <h2 className="display text-[clamp(2rem,5vw,3.6rem)]">Artwork specs</h2>
        <dl className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
          {SPECS.map(([k, v]) => (
            <div key={k} className="grid gap-2 py-5 md:grid-cols-[240px_1fr]">
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">{k}</dt>
              <dd className="text-[15px] text-ink/70">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <Link href="/design" className="rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
            Open the studio
          </Link>
          <Link href="/products" className="rounded-full border hairline px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/80 hover:border-ink hover:text-ink">
            See the blanks
          </Link>
        </div>
      </section>
    </div>
  );
}
