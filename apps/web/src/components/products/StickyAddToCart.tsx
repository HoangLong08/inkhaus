"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";

/**
 * The mobile buy bar. Appears once the real add-to-cart button has scrolled out
 * of view, so on a long product page the price and the action are never more
 * than a thumb away.
 *
 * It watches the real button rather than a scroll offset: the button is the
 * thing whose absence justifies this bar existing, and a fixed offset would be
 * wrong the moment the page above it changes height.
 *
 * z-40 keeps it under the cart drawer (z-50), which it must never cover.
 */
export default function StickyAddToCart({
  unitPrice,
  quantity,
  subtotal,
  disabled,
  onAdd,
  watch,
}: {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  disabled: boolean;
  onAdd: () => void;
  /** the element whose visibility decides whether this shows */
  watch: React.RefObject<HTMLElement | null>;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = watch.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        // "not visible" is not enough: on a phone the real button starts far
        // below the fold, so a plain !isIntersecting would show this bar the
        // instant the page loads — before the customer has seen the product,
        // let alone picked a size.
        //
        // Compare against `rootBounds`, not against zero. The observer reports
        // the exit at the moment the button's *bottom* crosses the top margin,
        // and with a -80px margin that happens while `top` is still positive —
        // a `top < 0` test simply never fires, and no further callback comes.
        const r = entry.boundingClientRect;
        const above = entry.rootBounds ? r.bottom <= entry.rootBounds.top : r.bottom <= 0;
        setShow(!entry.isIntersecting && above);
      },
      // a little slack, so the bar does not flicker while the button rides the
      // edge of the viewport
      { rootMargin: "-80px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold leading-none">
                ${unitPrice.toFixed(2)}
                <span className="ml-1 text-[10px] font-normal uppercase tracking-[0.12em] text-ink/40">
                  / unit
                </span>
              </p>
              <p className="mt-1 truncate text-[11px] text-ink/45">
                {quantity} {quantity === 1 ? "piece" : "pieces"} · ${subtotal.toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              data-testid="pdp-sticky-add-to-cart"
              onClick={onAdd}
              disabled={disabled}
              className="flex shrink-0 items-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink transition disabled:opacity-40"
            >
              <ShoppingBag size={15} />
              Add
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}