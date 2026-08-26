"use client";

import { useEffect } from "react";
import CartDrawer from "@/components/cart/CartDrawer";
import { CART_STORAGE_KEY, useCart } from "@/lib/cart";
import { sweepPendingDesigns } from "@/lib/cart-designs";

/**
 * Owns everything the cart needs to exist across the whole app: the one-time
 * read out of localStorage, keeping two open tabs in agreement, and the drawer
 * itself. Mounted once in the root layout.
 */
export default function CartRoot() {
  const hydrated = useCart((s) => s.hydrated);
  const lines = useCart((s) => s.lines);

  // Deferred out of module evaluation on purpose: the server rendered an empty
  // cart, so restoring one during the first client render is a hydration
  // mismatch. See the `skipHydration` note in lib/cart.
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);

  // Two tabs, one cart. Without this, adding on one tab and checking out on the
  // other silently drops the addition when the second tab writes last.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === CART_STORAGE_KEY) void useCart.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Artwork parked for a checkout retry outlives the line it belonged to unless
  // something collects it. Never before hydration, or it would bin the designs
  // for the very cart about to be restored.
  useEffect(() => {
    if (!hydrated) return;
    const keys = lines.map((l) => l.design?.key).filter((k): k is string => !!k);
    void sweepPendingDesigns(keys);
  }, [hydrated, lines]);

  return <CartDrawer />;
}
