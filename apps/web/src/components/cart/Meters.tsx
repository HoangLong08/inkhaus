"use client";

import { Truck, TrendingDown } from "lucide-react";
import { FREE_SHIPPING_OVER, SHIPPING_FLAT, type Product } from "@/lib/catalog";
import { nextTier } from "@/lib/cart";

/** How much further the cart has to go before shipping stops being charged. */
export function FreeShippingMeter({ subtotal }: { subtotal: number }) {
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_OVER) * 100));
  const earned = subtotal >= FREE_SHIPPING_OVER;

  return (
    <div>
      <p className="flex items-center gap-2 text-[12px] text-ink/55">
        <Truck size={14} className={earned ? "text-acid-2" : "text-ink/35"} aria-hidden />
        {earned ? (
          <span>
            <b className="text-acid-2">Free US shipping</b> — it&apos;s on us from here.
          </span>
        ) : (
          <span>
            <b className="text-ink">${(FREE_SHIPPING_OVER - subtotal).toFixed(2)}</b> more for free US
            shipping <span className="text-ink/35">(${SHIPPING_FLAT.toFixed(2)} flat until then)</span>
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progress toward free shipping"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)] ${
            earned ? "bg-acid-2" : "bg-ink/45"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The next volume tier for one line. Silent at the deepest tier and whenever the
 * bulk-price floor has already eaten the discount — a nudge that saves nothing
 * is just noise.
 */
export function TierHint({
  product,
  quantity,
  className = "",
}: {
  product: Product;
  quantity: number;
  className?: string;
}) {
  const next = nextTier(product, quantity);
  if (!next || next.needed <= 0) return null;

  return (
    <p className={`flex items-start gap-1.5 text-[11px] leading-relaxed text-acid-2 ${className}`}>
      <TrendingDown size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        Add <b>{next.needed}</b> more to reach the {next.min}+ tier — saves ${next.perUnit.toFixed(2)}{" "}
        a unit.
      </span>
    </p>
  );
}
