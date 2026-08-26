import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline — INKHAUS",
  description: "You're offline. The studio and the catalogue still work.",
};

const AVAILABLE = [
  ["/design", "The design studio", "Every tool runs in your browser. Upload art, set type, export a mockup — none of it needs a connection."],
  ["/products", "The catalogue", "All eight garments, every colourway, full pricing."],
  ["/bulk", "Bulk pricing", "The volume calculator does its own maths."],
  ["/how-it-works", "How it works", "Print methods and artwork specs."],
];

export default function OfflinePage() {
  return (
    <div className="pt-[calc(var(--nav-h)+60px)]">
      <header className="edge pb-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-flame">No connection</p>
        <h1 className="display mt-5 text-[clamp(3rem,10vw,8rem)] leading-[0.85]">
          You&apos;re offline
          <span className="text-acid-2">.</span>
        </h1>
        <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-ink/55">
          That page isn&apos;t in your device&apos;s cache. Most of INKHAUS is, though — and your
          saved design is stored on this device, not on our servers, so it&apos;s still here.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/design"
            className="rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink"
          >
            Back to the studio
          </Link>
          <Link
            href="/"
            className="rounded-full border hairline px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/80 hover:border-ink hover:text-ink"
          >
            Home
          </Link>
        </div>
      </header>

      <section className="edge grid gap-3 border-t hairline py-16 md:grid-cols-2">
        {AVAILABLE.map(([href, title, body]) => (
          <Link
            key={href}
            href={href}
            className="h-full rounded-2xl border hairline bg-paper-2 p-7 transition hover:bg-paper-3"
          >
            <p className="display text-[22px]">{title}</p>
            <p className="mt-3 text-[14px] leading-relaxed text-ink/50">{body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
