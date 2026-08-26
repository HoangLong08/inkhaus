"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { selectCount, useCart } from "@/lib/cart";

/**
 * The header's way in. The badge stays absent until the cart has been read out
 * of localStorage, so the server HTML and the first client render agree.
 */
export default function CartButton({ className = "" }: { className?: string }) {
  const count = useCart(selectCount);
  const hydrated = useCart((s) => s.hydrated);
  const open = useCart((s) => s.openDrawer);
  const shown = hydrated ? count : 0;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={shown > 0 ? `Cart, ${shown} pieces` : "Cart, empty"}
      data-testid="cart-button"
      className={`relative grid h-10 w-10 place-items-center rounded-full border hairline text-ink/80 transition hover:border-acid-2 hover:text-acid-2 ${className}`}
    >
      <ShoppingBag size={16} />
      <AnimatePresence>
        {shown > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            data-testid="cart-count"
            className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-acid px-1 text-[10px] font-bold tabular-nums text-ink"
          >
            {shown > 99 ? "99+" : shown}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
