"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ShoppingBag } from "lucide-react";
import { FREE_SHIPPING_OVER } from "@/lib/catalog";

const NAV = [
  { href: "/products", label: "Shop blanks" },
  { href: "/design", label: "Design studio" },
  { href: "/bulk", label: "Teams & bulk" },
  { href: "/how-it-works", label: "How it works" },
];

const TICKER = [
  "Printed in Los Angeles + Charlotte",
  "No minimums",
  `Free US shipping over $${FREE_SHIPPING_OVER}`,
  "3–5 day delivery",
  "Free digital proof in 2 hours",
  "Reprint guarantee",
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[100]">
        <div className="overflow-hidden border-b hairline bg-acid text-ink">
          <div className="marquee-track" style={{ "--dur": "34s" } as React.CSSProperties}>
            {[0, 1].map((k) => (
              <div
                key={k}
                className="flex shrink-0 items-center gap-10 py-1.5 pr-10 text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                {TICKER.map((t) => (
                  <span key={t} className="flex shrink-0 items-center gap-10">
                    {t} <span className="opacity-40">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <header
          className={`transition-all duration-500 ${
            scrolled ? "border-b hairline bg-paper/85 backdrop-blur-xl" : "bg-transparent"
          }`}
        >
          <div className="edge flex h-[var(--nav-h)] items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-sm bg-acid text-ink">
                <span className="display text-[15px] leading-none">IH</span>
              </span>
              <span className="display text-[19px] tracking-[0.06em]">INKHAUS</span>
            </Link>

            <nav className="hidden items-center gap-9 lg:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="link-underline text-[13px] font-medium uppercase tracking-[0.14em] text-ink/70 hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button
                aria-label="Cart"
                className="hidden h-10 w-10 place-items-center rounded-full border hairline text-ink/80 transition hover:border-acid-2 hover:text-acid-2 sm:grid"
              >
                <ShoppingBag size={16} />
              </button>
              <Link
                href="/design"
                className="group relative hidden overflow-hidden rounded-full bg-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-paper transition-colors duration-500 hover:text-ink sm:inline-flex"
              >
                <span className="relative z-10">Start designing</span>
                <span className="absolute inset-0 -translate-y-full bg-acid transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
              </Link>
              <button
                onClick={() => setOpen(true)}
                aria-label="Menu"
                className="grid h-10 w-10 place-items-center rounded-full border hairline lg:hidden"
              >
                <Menu size={17} />
              </button>
            </div>
          </div>
        </header>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[200] bg-paper"
          >
            <div className="edge flex h-[calc(var(--nav-h)+30px)] items-center justify-between">
              <span className="display text-[19px]">INKHAUS</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-full border hairline"
              >
                <X size={17} />
              </button>
            </div>
            <nav className="edge mt-8 flex flex-col">
              {NAV.map((n, i) => (
                <motion.div
                  key={n.href}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.7 }}
                >
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="display block border-b hairline py-5 text-[clamp(2.2rem,11vw,4.5rem)] hover:text-acid-2"
                  >
                    {n.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
