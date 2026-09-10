import type { Product } from "./catalog";

/** volume discount ladder used across the site and the API */
export const TIERS = [
  { min: 1, off: 0 },
  { min: 6, off: 0.12 },
  { min: 12, off: 0.24 },
  { min: 24, off: 0.38 },
  { min: 50, off: 0.52 },
  { min: 100, off: 0.6 },
  { min: 250, off: 0.66 },
];

export const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
export type Size = (typeof SIZES)[number];

/**
 * A mug has no size M. Non-apparel carries this single code instead of the
 * apparel run, so the cart, the quote and the API all keep one size axis
 * rather than growing a second concept for "no size".
 */
export const ONE_SIZE = ["OS"] as const;

/** every size code the `sizes` table has to know about — the seed reads this */
export const ALL_SIZE_CODES = [...SIZES, ...ONE_SIZE] as const;

/** sizes above XL cost more blank — applied per unit on top of the tier price */
export const SIZE_UPCHARGE: Record<string, number> = {
  XS: 0, S: 0, M: 0, L: 0, XL: 0, "2XL": 2, "3XL": 4, OS: 0,
};

/** display only — a code with no entry renders as itself */
export const SIZE_LABEL: Record<string, string> = {
  OS: "One size",
};

/**
 * The size run a product actually stocks. Everything that iterates sizes must
 * go through this: `cleanSizes` in the cart drops any quantity whose code is
 * not in the run, so an "OS" line filtered against the apparel run would be
 * silently deleted on the next page load.
 */
export function sizesFor(p: Pick<Product, "sizes">): readonly string[] {
  return p.sizes?.length ? p.sizes : SIZES;
}

/**
 * Shipping thresholds live here for the same reason the tier ladder does: the
 * storefront promises them and the API charges them, so they cannot be two numbers.
 * The API still lets `SHIPPING_FLAT` / `FREE_SHIPPING_OVER` in the environment win.
 */
export const SHIPPING_FLAT = 6.5;
export const FREE_SHIPPING_OVER = 75;

export type Tier = { min: number; off: number };

/** the deepest tier the quantity qualifies for */
export function tierFor(qty: number, tiers: Tier[] = TIERS): Tier {
  return [...tiers].reverse().find((t) => qty >= t.min) ?? tiers[0];
}

/** price of one unit at a given total quantity — never below the 50+ floor */
export function unitPrice(
  p: Pick<Product, "price" | "bulkPrice">,
  qty: number,
  tiers: Tier[] = TIERS
) {
  const tier = tierFor(qty, tiers);
  return Math.max(p.bulkPrice, p.price * (1 - tier.off));
}

export type QuoteLineInput = { size: string; qty: number };

export type QuoteLine = {
  size: string;
  qty: number;
  unitPrice: number;
  upcharge: number;
  lineTotal: number;
};

export type Quote = {
  quantity: number;
  tier: Tier;
  baseUnitPrice: number;
  lines: QuoteLine[];
  subtotal: number;
  /** what the same order would cost with no volume discount */
  listTotal: number;
  savings: number;
};

/**
 * Single source of truth for what an order costs. The quantity ladder is applied
 * on the TOTAL across sizes, then each line adds its own blank upcharge.
 */
export function quote(
  p: Pick<Product, "price" | "bulkPrice">,
  input: QuoteLineInput[],
  opts: { tiers?: Tier[]; upcharges?: Record<string, number> } = {}
): Quote {
  const tiers = opts.tiers ?? TIERS;
  const upcharges = opts.upcharges ?? SIZE_UPCHARGE;
  const lines = input.filter((l) => l.qty > 0);
  const quantity = lines.reduce((n, l) => n + l.qty, 0);
  const base = unitPrice(p, quantity, tiers);

  const priced: QuoteLine[] = lines.map((l) => {
    const upcharge = upcharges[l.size] ?? 0;
    return {
      size: l.size,
      qty: l.qty,
      unitPrice: round(base + upcharge),
      upcharge,
      lineTotal: round((base + upcharge) * l.qty),
    };
  });

  const subtotal = round(priced.reduce((s, l) => s + l.lineTotal, 0));
  const listTotal = round(
    priced.reduce((s, l) => s + (p.price + (upcharges[l.size] ?? 0)) * l.qty, 0)
  );

  return {
    quantity,
    tier: tierFor(quantity, tiers),
    baseUnitPrice: round(base),
    lines: priced,
    subtotal,
    listTotal,
    savings: round(listTotal - subtotal),
  };
}

export const round = (n: number) => Math.round(n * 100) / 100;

// ------------------------------------------------------------- the ladder

/** bounds on a ladder the back office may save */
export const TIER_LIMITS = {
  maxTiers: 12,
  /** the database column is Decimal(4,3) and a 90%+ discount is a typo */
  maxOff: 0.9,
  maxMin: 100_000,
} as const;

/**
 * Why a tier ladder cannot be saved, or null when it can. Shared so the tier
 * editor shows the same sentence the API refuses with.
 *
 * A ladder starts at one unit with no discount, quantities strictly increase,
 * and a bigger order never gets a smaller discount - `tierFor` walks the ladder
 * from the top, so an unordered one would silently price the wrong tier.
 */
export function validateTiers(tiers: Tier[]): string | null {
  if (tiers.length < 1 || tiers.length > TIER_LIMITS.maxTiers) {
    return `A ladder needs between 1 and ${TIER_LIMITS.maxTiers} tiers.`;
  }
  if (tiers[0].min !== 1 || tiers[0].off !== 0) {
    return "The first tier must start at 1 unit with no discount.";
  }

  for (const [i, t] of tiers.entries()) {
    const n = i + 1;
    if (!Number.isInteger(t.min) || t.min < 1 || t.min > TIER_LIMITS.maxMin) {
      return `Tier ${n}: the quantity must be a whole number from 1 to ${TIER_LIMITS.maxMin}.`;
    }
    if (!Number.isFinite(t.off) || t.off < 0 || t.off > TIER_LIMITS.maxOff) {
      return `Tier ${n}: the discount must be between 0% and ${TIER_LIMITS.maxOff * 100}%.`;
    }
    if (Math.abs(Math.round(t.off * 1000) - t.off * 1000) > 1e-6) {
      return `Tier ${n}: the discount can have at most one decimal place as a percentage.`;
    }
    if (i > 0) {
      const prev = tiers[i - 1];
      if (t.min <= prev.min) return "Quantities must increase from one tier to the next.";
      if (t.off < prev.off) return "A bigger order can never get a smaller discount.";
    }
  }
  return null;
}
