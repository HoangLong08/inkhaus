import Link from "next/link";

const GROUPS: { title: string; links: [string, string][] }[] = [
  // category links rather than individual slugs: an aisle survives a product
  // being renamed or retired, a hard-coded slug does not
  {
    title: "Shop",
    links: [
      ["Apparel", "/products?cat=apparel"],
      ["Headwear", "/products?cat=headwear"],
      ["Drinkware", "/products?cat=drinkware"],
      ["Home", "/products?cat=home"],
      ["All blanks", "/products"],
    ],
  },
  {
    title: "Make",
    links: [
      ["Design studio", "/design"],
      ["Upload artwork", "/design"],
      ["Team & bulk orders", "/bulk"],
      ["Get a quote", "/bulk"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Track an order", "/orders"],
      ["How it works", "/how-it-works"],
      ["Size guide", "/how-it-works"],
      ["Shipping & returns", "/how-it-works"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="relative border-t hairline bg-paper">
      <div className="edge grid gap-14 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-20">
        <div>
          <h3 className="display text-[clamp(2rem,4vw,3rem)]">
            Print<span className="text-acid-2">.</span>
            <br />
            Wear<span className="text-acid-2">.</span>
            <br />
            Repeat<span className="text-acid-2">.</span>
          </h3>
          <p className="mt-5 max-w-xs text-sm text-ink/50">
            Custom apparel printed in Los Angeles &amp; Charlotte. Ships across the US in 3–5 days,
            worldwide in 6–12.
          </p>
          <form className="mt-7 flex max-w-sm items-center gap-2 border-b hairline pb-2">
            <input
              placeholder="you@email.com"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink/30"
            />
            <button className="shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-acid-2">
              Join →
            </button>
          </form>
        </div>

        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40">{g.title}</p>
            <ul className="mt-5 space-y-3">
              {g.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="link-underline text-sm text-ink/75 hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="overflow-hidden border-y hairline py-3">
        <div className="marquee-track" style={{ "--dur": "40s" } as React.CSSProperties}>
          {[0, 1].map((k) => (
            <span key={k} className="display shrink-0 pr-8 text-[clamp(3rem,9vw,8rem)] text-ink/[0.07]">
              INKHAUS — CUSTOM APPAREL — NO MINIMUMS — MADE IN USA —&nbsp;
            </span>
          ))}
        </div>
      </div>

      <div className="edge flex flex-col gap-3 py-6 text-[11px] uppercase tracking-[0.14em] text-ink/35 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Inkhaus Supply Co.</span>
        <div className="flex flex-wrap gap-5">
          <Link href="#" className="hover:text-ink">Terms</Link>
          <Link href="#" className="hover:text-ink">Privacy</Link>
          <Link href="#" className="hover:text-ink">DMCA</Link>
          <Link href="#" className="hover:text-ink">Do not sell my info</Link>
        </div>
      </div>
    </footer>
  );
}
