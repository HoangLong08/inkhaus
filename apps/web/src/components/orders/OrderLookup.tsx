"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useRecentOrders } from "@/lib/recent-orders";

/**
 * Order numbers are printed as `INK-000123` but people type what they remember.
 * Bare digits get padded, lowercase gets raised, whitespace is dropped.
 */
export function normalizeOrderNumber(input: string): string {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d+$/.test(raw)) return `INK-${raw.padStart(6, "0")}`;
  const m = /^INK-?(\d+)$/.exec(raw);
  if (m) return `INK-${m[1].padStart(6, "0")}`;
  return raw;
}

export default function OrderLookup() {
  const router = useRouter();
  const recent = useRecentOrders();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const number = normalizeOrderNumber(value);
    if (!/^INK-\d{6,}$/.test(number)) {
      setError("Order numbers look like INK-000123.");
      return;
    }
    router.push(`/orders/${encodeURIComponent(number)}`);
  };

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge pb-24">
        <header className="border-b hairline pb-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">Order status</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,8vw,5.5rem)]">Where is it?</h1>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink/50">
            Type the number from your confirmation email and we will show you exactly where the
            order sits — proof, press, or on a truck.
          </p>
        </header>

        <form onSubmit={submit} className="mt-9 max-w-md">
          <label
            htmlFor="order-number"
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45"
          >
            Order number
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/30"
                aria-hidden
              />
              <input
                id="order-number"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder="INK-000123"
                autoComplete="off"
                aria-invalid={!!error}
                aria-describedby={error ? "order-number-error" : undefined}
                className={`w-full rounded-xl border bg-paper-2 py-3.5 pl-11 pr-4 text-[15px] uppercase tracking-[0.06em] outline-none transition focus:border-acid-2 ${
                  error ? "border-flame" : "hairline"
                }`}
              />
            </div>
            <button
              type="submit"
              className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-xl bg-acid text-ink transition hover:bg-ink hover:text-paper"
              aria-label="Look up this order"
            >
              <ArrowRight size={17} />
            </button>
          </div>
          {error && (
            <p id="order-number-error" className="mt-2 text-[12px] text-flame">
              {error}
            </p>
          )}
        </form>

        {recent.length > 0 && (
          <section className="mt-14">
            <h2 className="display text-[24px]">Placed from this device</h2>
            <ul className="mt-5 max-w-2xl divide-y divide-ink/10 border-y hairline">
              {recent.map((o) => (
                <li key={o.number}>
                  <Link
                    href={`/orders/${encodeURIComponent(o.number)}`}
                    className="group flex items-center justify-between gap-4 py-4 transition hover:text-acid-2"
                  >
                    <span>
                      <span className="text-[15px] font-semibold">{o.number}</span>
                      <span className="ml-3 text-[12px] text-ink/40">
                        {o.quantity} {o.quantity === 1 ? "piece" : "pieces"} ·{" "}
                        {new Date(o.placedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-[15px] font-semibold tabular-nums">
                        ${o.total.toFixed(2)}
                      </span>
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink/35">
              Kept in this browser only — the order itself lives on our servers.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
