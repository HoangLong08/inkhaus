"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X, PenLine } from "lucide-react";
import LineThumb from "@/components/cart/LineThumb";
import { FreeShippingMeter, TierHint } from "@/components/cart/Meters";
import { readCart, useCart, type ResolvedLine } from "@/lib/cart";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function CartDrawer() {
  const open = useCart((s) => s.drawerOpen);
  const close = useCart((s) => s.closeDrawer);
  const lines = useCart((s) => s.lines);
  const lastAdded = useCart((s) => s.lastAdded);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** whatever had focus before the drawer took it, to hand back on close */
  const opener = useRef<HTMLElement | null>(null);

  const { lines: resolved, totals } = useMemo(() => readCart(lines), [lines]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // the panel animates in, so focus after the first frame or the browser
    // scrolls the still-offscreen element into view
    const t = setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      opener.current?.focus?.();
    };
  }, [open]);

  // Escape closes; Tab cycles inside the panel. Without the second half, tabbing
  // walks straight out into the page behind the backdrop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[300]"
          role="dialog"
          aria-modal="true"
          aria-label="Your cart"
          data-testid="cart-drawer"
        >
          <motion.button
            type="button"
            aria-label="Close the cart"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/45 backdrop-blur-[2px]"
          />

          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l hairline bg-paper shadow-[0_0_80px_rgba(0,0,0,0.25)]"
          >
            <header className="flex items-center justify-between gap-4 border-b hairline px-5 py-4">
              <div>
                <h2 className="display text-[22px]">Your cart</h2>
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink/40">
                  {totals.quantity} {totals.quantity === 1 ? "piece" : "pieces"} ·{" "}
                  {resolved.length} {resolved.length === 1 ? "line" : "lines"}
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={close}
                aria-label="Close the cart"
                className="grid h-10 w-10 place-items-center rounded-full border hairline transition hover:border-ink"
              >
                <X size={17} />
              </button>
            </header>

            {resolved.length === 0 ? (
              <EmptyCart onNavigate={close} />
            ) : (
              <>
                <div className="border-b hairline px-5 py-4">
                  <FreeShippingMeter subtotal={totals.subtotal} />
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                  <ul className="space-y-4">
                    {resolved.map((line) => (
                      <DrawerLine key={line.id} line={line} justAdded={line.id === lastAdded} />
                    ))}
                  </ul>
                </div>

                <footer className="border-t hairline bg-paper-2 px-5 py-5">
                  <dl className="space-y-1.5 text-[13px]">
                    <Row label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
                    {totals.savings > 0 && (
                      <Row
                        label="Volume discount"
                        value={`− $${totals.savings.toFixed(2)}`}
                        tone="acid"
                      />
                    )}
                    <Row
                      label="Shipping"
                      value={totals.shipping === 0 ? "Free" : `$${totals.shipping.toFixed(2)}`}
                    />
                    <Row label="Total" value={`$${totals.total.toFixed(2)}`} strong />
                  </dl>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href="/cart"
                      onClick={close}
                      className="rounded-full border hairline py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.14em] text-ink/70 transition hover:border-ink hover:text-ink"
                    >
                      View cart
                    </Link>
                    <Link
                      href="/checkout"
                      onClick={close}
                      className="rounded-full bg-acid py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
                    >
                      Checkout
                    </Link>
                  </div>
                  <p className="mt-2.5 text-center text-[10px] uppercase tracking-[0.14em] text-ink/35">
                    Free proof in 2h · 3–5 day US delivery
                  </p>
                </footer>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function EmptyCart({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-paper-2 text-ink/30">
        <ShoppingBag size={24} />
      </span>
      <div>
        <p className="display text-[24px]">Nothing in here yet</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/50">
          Pick a blank and put something on it — no minimums, and the price drops as the count goes
          up.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/design"
          onClick={onNavigate}
          className="rounded-full bg-acid px-5 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-ink"
        >
          Open the studio
        </Link>
        <Link
          href="/products"
          onClick={onNavigate}
          className="rounded-full border hairline px-5 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-ink/70 hover:border-ink hover:text-ink"
        >
          Shop blanks
        </Link>
      </div>
    </div>
  );
}

function DrawerLine({ line, justAdded }: { line: ResolvedLine; justAdded: boolean }) {
  const setSize = useCart((s) => s.setSize);
  const remove = useCart((s) => s.remove);
  const close = useCart((s) => s.closeDrawer);

  return (
    <motion.li
      layout
      initial={justAdded ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      data-testid="cart-line"
      className={`rounded-2xl border p-3 transition-colors ${
        justAdded ? "border-acid-2 bg-acid/10" : "hairline bg-paper"
      }`}
    >
      <div className="flex gap-3">
        <LineThumb line={line} className="h-20 w-16" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/products/${line.product.slug}`}
                onClick={close}
                className="block truncate text-[14px] font-semibold hover:text-acid-2"
              >
                {line.product.name}
              </Link>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink/45">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-ink/20 align-middle"
                  style={{ background: line.color.hex }}
                  aria-hidden
                />
                {line.color.name} · {line.method}
              </p>
              {line.design && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-ink/50">
                  <PenLine size={10} aria-hidden />
                  Custom · {line.design.sides?.join(" + ") ?? "front"}
                </p>
              )}
            </div>

            <button
              onClick={() => remove(line.id)}
              aria-label={`Remove ${line.product.name} from the cart`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-flame/10 hover:text-flame"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {line.entries.map(({ size, qty }) => (
              <span
                key={size}
                className="flex items-center gap-1 rounded-lg border hairline bg-paper-2 py-0.5 pl-2 pr-0.5 text-[11px]"
              >
                <b className="uppercase tracking-[0.08em] text-ink/60">{size}</b>
                <button
                  onClick={() => setSize(line.id, size, qty - 1)}
                  aria-label={`One less ${size} of the ${line.product.name}`}
                  className="grid h-5 w-5 place-items-center rounded text-ink/45 transition hover:bg-paper-3 hover:text-ink"
                >
                  <Minus size={10} />
                </button>
                <span className="min-w-[1.6ch] text-center font-semibold tabular-nums">{qty}</span>
                <button
                  onClick={() => setSize(line.id, size, qty + 1)}
                  aria-label={`One more ${size} of the ${line.product.name}`}
                  className="grid h-5 w-5 place-items-center rounded text-ink/45 transition hover:bg-paper-3 hover:text-ink"
                >
                  <Plus size={10} />
                </button>
              </span>
            ))}
          </div>

          <div className="mt-2.5 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="text-ink/45">
              {line.quantity} × ${line.quote.baseUnitPrice.toFixed(2)}
              {line.quote.tier.off > 0 && (
                <span className="ml-1 text-acid-2">−{Math.round(line.quote.tier.off * 100)}%</span>
              )}
            </span>
            <b className="text-[14px]">${line.quote.subtotal.toFixed(2)}</b>
          </div>

          <TierHint product={line.product} quantity={line.quantity} className="mt-1.5" />
        </div>
      </div>
    </motion.li>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "acid";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-ink/50"}>{label}</dt>
      <dd
        className={
          strong
            ? "text-[17px] font-semibold tabular-nums"
            : `tabular-nums ${tone === "acid" ? "text-acid-2" : "text-ink/70"}`
        }
      >
        {value}
      </dd>
    </div>
  );
}
