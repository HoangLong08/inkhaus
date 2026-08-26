"use client";

import { Minus, Plus } from "lucide-react";
import { SIZES, SIZE_UPCHARGE } from "@/lib/catalog";

/**
 * The size/quantity grid — the control apparel is actually bought with.
 *
 * A single "quantity" box is wrong for this shop: the volume tier is earned on
 * the total across sizes (6xM + 6xL is a 12+ order), so the customer has to be
 * able to spread one order over the whole run in one place.
 */
/**
 * How wide the cells get to be, which decides whether [− 12 +] fits on one line.
 *   wide  — a product page column
 *   dense — the cart's line cards, all seven sizes in a row on a big screen
 *   panel — the studio's 360px sidebar, which is narrow at every breakpoint
 */
const LAYOUTS = {
  wide: { cols: "grid-cols-2 sm:grid-cols-4", stacked: false },
  dense: { cols: "grid-cols-4 sm:grid-cols-7", stacked: true },
  panel: { cols: "grid-cols-4", stacked: true },
} as const;

export default function SizeGrid({
  value,
  onChange,
  layout = "wide",
  idPrefix = "size",
}: {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  layout?: keyof typeof LAYOUTS;
  /** disambiguates the input ids when two grids are on one page */
  idPrefix?: string;
}) {
  const { cols, stacked: compact } = LAYOUTS[layout];

  const set = (size: string, qty: number) => {
    const n = Math.max(0, Math.min(9999, Math.floor(Number.isFinite(qty) ? qty : 0)));
    const next = { ...value };
    if (n > 0) next[size] = n;
    else delete next[size];
    onChange(next);
  };

  return (
    <div className={`grid gap-1.5 ${cols}`}>
      {SIZES.map((s) => {
        const qty = value[s] ?? 0;
        const upcharge = SIZE_UPCHARGE[s] ?? 0;
        return (
          <div
            key={s}
            className={`rounded-xl border px-2 py-2 transition ${
              qty > 0 ? "border-acid-2 bg-acid/10" : "hairline bg-paper"
            }`}
          >
            <label
              htmlFor={`${idPrefix}-${s}`}
              className="flex items-baseline justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50"
            >
              {s}
              {upcharge > 0 && <span className="text-[9px] text-flame">+${upcharge}</span>}
            </label>

            {/* A narrow cell has no room for [− 999 +] on one line — the digits
                get clipped. The stacked layouts put the value over the steppers. */}
            <div
              className={
                compact
                  ? "mt-1 flex flex-col items-stretch"
                  : "mt-1.5 flex items-center justify-between gap-0.5"
              }
            >
              {!compact && (
                <Step label={`One less ${s}`} disabled={qty === 0} onClick={() => set(s, qty - 1)}>
                  <Minus size={12} />
                </Step>
              )}

              <input
                id={`${idPrefix}-${s}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                value={qty === 0 ? "" : qty}
                placeholder="0"
                aria-label={`Quantity, size ${s}`}
                onChange={(e) => set(s, +e.target.value)}
                className="w-full min-w-0 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none placeholder:text-ink/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />

              {compact ? (
                <div className="mt-0.5 flex items-center justify-between">
                  <Step label={`One less ${s}`} disabled={qty === 0} onClick={() => set(s, qty - 1)}>
                    <Minus size={11} />
                  </Step>
                  <Step label={`One more ${s}`} onClick={() => set(s, qty + 1)}>
                    <Plus size={11} />
                  </Step>
                </div>
              ) : (
                <Step label={`One more ${s}`} onClick={() => set(s, qty + 1)}>
                  <Plus size={12} />
                </Step>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Step({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink/50 transition hover:bg-paper-3 hover:text-ink disabled:opacity-25"
    >
      {children}
    </button>
  );
}
