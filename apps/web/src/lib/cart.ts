"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  COLORS,
  FREE_SHIPPING_OVER,
  SHIPPING_FLAT,
  SIZE_UPCHARGE,
  TIERS,
  getProduct,
  quote,
  round,
  sizesFor,
  unitPrice,
  type Colorway,
  type Product,
  type Quote,
} from "@/lib/catalog";
import type { PrintMethodEnum } from "@/lib/api";

/* ------------------------------------------------------------------ *
 * Identity bridges
 *
 * `Colorway` and `Product.method` are the display shapes the storefront has
 * always rendered — a hex and a label. `POST /orders` wants the database's
 * natural keys. These two maps are the web-side mirror of
 * `apps/api/src/modules/catalog/catalog.mapper.ts`, and the seed reads the
 * colour one in the same direction (hex -> slug), so they cannot drift.
 * ------------------------------------------------------------------ */

const COLOR_SLUG_BY_HEX = new Map(
  Object.entries(COLORS).map(([slug, c]) => [c.hex.toLowerCase(), slug]),
);

export function colorSlug(c: Colorway): string {
  return (
    COLOR_SLUG_BY_HEX.get(c.hex.toLowerCase()) ??
    c.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
  );
}

/**
 * Careful: this is a `Record<string, ...>`, so TypeScript will NOT tell you when
 * a new `Product.method` label has no entry. `normalise()` returns null for an
 * unmapped label and `sanitizeLines` then deletes that line out of a saved cart,
 * silently. The catalog invariant test is what actually guards this — keep it in
 * step with METHOD_TO_LABEL in apps/api/src/modules/catalog/catalog.mapper.ts.
 */
export const METHOD_ENUM: Record<string, PrintMethodEnum> = {
  DTG: "DTG",
  "Screen print": "SCREEN_PRINT",
  Embroidery: "EMBROIDERY",
  Puff: "PUFF",
  "Leather patch": "LEATHER_PATCH",
  Sublimation: "SUBLIMATION",
  "UV print": "UV_PRINT",
  Engraving: "ENGRAVING",
  "Digital print": "DIGITAL_PRINT",
};

/** the way back, for anything read off an order */
export const METHOD_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(METHOD_ENUM).map(([label, value]) => [value, label]),
);

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/** what a customised line carries; the fabric scene itself lives in IndexedDB */
export type CartDesign = {
  /** local, stable across API retries — also what keys the IndexedDB record */
  key: string;
  /** set once `POST /designs` has accepted it; without it the order has no artwork */
  publicId?: string;
  name?: string;
  /** small jpeg data-url of the front mockup, for the cart thumbnails */
  preview?: string;
  /** which sides actually carry artwork */
  sides?: ("front" | "back")[];
};

export type CartLine = {
  id: string;
  productSlug: string;
  colorSlug: string;
  /** the label, e.g. "Screen print" — mapped to the enum at checkout */
  method: string;
  /** size code -> units */
  sizes: Record<string, number>;
  design?: CartDesign;
  addedAt: number;
};

/** everything a line needs to render, resolved against the live catalog */
export type ResolvedLine = CartLine & {
  product: Product;
  color: Colorway;
  quote: Quote;
  /** sizes in catalog order, zeroes dropped */
  entries: { size: string; qty: number }[];
  quantity: number;
};

export type CartTotals = {
  quantity: number;
  subtotal: number;
  listTotal: number;
  savings: number;
  shipping: number;
  tax: number;
  total: number;
  /** what still has to be spent to earn free shipping, 0 once earned */
  freeShippingGap: number;
};

/** the API's default (`TAX_RATE=0`); it recomputes and its number is the one charged */
const TAX_RATE = 0;

/** `ArrayMaxSize(50)` on CreateOrderDto.items */
const MAX_LINES = 50;
const MAX_QTY_PER_SIZE = 9999;

/* ------------------------------------------------------------------ *
 * Pricing
 *
 * The volume tier is applied per LINE, across that line's sizes — exactly what
 * `OrdersService.priceItem` does. Two separate lines do not pool their
 * quantities, so the cart must never sum first and price second.
 * ------------------------------------------------------------------ */

export function resolveLine(line: CartLine): ResolvedLine | null {
  const product = getProduct(line.productSlug);
  if (!product) return null;
  const color = product.colors.find((c) => colorSlug(c) === line.colorSlug);
  if (!color) return null;

  // the blank's own run, not the global apparel one — a one-size mug keeps
  // its "OS" quantity instead of resolving to an empty line
  const entries = sizesFor(product)
    .filter((s) => (line.sizes[s] ?? 0) > 0)
    .map((s) => ({ size: s, qty: line.sizes[s] }));

  return {
    ...line,
    product,
    color,
    entries,
    quantity: entries.reduce((n, e) => n + e.qty, 0),
    quote: quote(product, entries),
  };
}

export function cartTotals(lines: ResolvedLine[]): CartTotals {
  const quantity = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = round(lines.reduce((s, l) => s + l.quote.subtotal, 0));
  const listTotal = round(lines.reduce((s, l) => s + l.quote.listTotal, 0));
  // an empty cart ships for nothing, not for $6.50
  const shipping = quantity === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  const tax = round(subtotal * TAX_RATE);

  return {
    quantity,
    subtotal,
    listTotal,
    savings: round(listTotal - subtotal),
    shipping,
    tax,
    total: round(subtotal + shipping + tax),
    freeShippingGap: subtotal >= FREE_SHIPPING_OVER ? 0 : round(FREE_SHIPPING_OVER - subtotal),
  };
}

/**
 * The next volume tier this line has not reached yet, and what reaching it is
 * worth. Returns null past the deepest tier, and also once the bulk floor has
 * swallowed the discount — promising a saving of $0.00 is worse than silence.
 */
export function nextTier(product: Product, quantity: number) {
  const qty = Math.max(quantity, 1);
  const next = TIERS.find((t) => t.min > qty);
  if (!next) return null;

  const perUnit = round(unitPrice(product, qty) - unitPrice(product, next.min));
  if (perUnit <= 0) return null;

  return {
    ...next,
    needed: next.min - quantity,
    /** per unit, at the new tier */
    perUnit,
    /** what the whole line would save if it were topped up to the tier minimum */
    saves: round(perUnit * next.min),
  };
}

/* ------------------------------------------------------------------ *
 * Normalisation
 *
 * Lines come back from localStorage after the catalog may have moved on — a
 * blank unstocked in that colour, a print method withdrawn, a size renamed.
 * `POST /orders` rejects every one of those, so they are cleaned up here rather
 * than at the till.
 * ------------------------------------------------------------------ */

/**
 * Keeps only the codes the blank actually stocks. It takes the product rather
 * than reading the global `SIZES` because the run is per-product now: filtering
 * an "OS" mug against the apparel run would empty the line, and an empty line
 * is deleted by `normalise`.
 */
function cleanSizes(
  product: Pick<Product, "sizes">,
  sizes: Record<string, number> | undefined,
) {
  const out: Record<string, number> = {};
  for (const s of sizesFor(product)) {
    const n = Math.floor(Number(sizes?.[s] ?? 0));
    if (Number.isFinite(n) && n > 0) out[s] = Math.min(n, MAX_QTY_PER_SIZE);
  }
  return out;
}

function normalise(line: CartLine): CartLine | null {
  const product = getProduct(line.productSlug);
  if (!product) return null;
  if (!product.colors.some((c) => colorSlug(c) === line.colorSlug)) return null;

  const sizes = cleanSizes(product, line.sizes);
  if (Object.keys(sizes).length === 0) return null;

  // a withdrawn print method falls back to the blank's first supported one
  // rather than dropping artwork the customer already paid attention to
  const method = product.method.includes(line.method) ? line.method : product.method[0];
  if (!method || !METHOD_ENUM[method]) return null;

  // the id encodes the identity, so a fallback above has to be reflected in it
  // or the same variant could end up as two lines that never merge
  const next = { ...line, sizes, method };
  next.id = lineId(next);
  return next;
}

export function sanitizeLines(lines: CartLine[]): CartLine[] {
  const byId = new Map<string, CartLine>();

  for (const raw of lines) {
    const line = normalise(raw);
    if (!line) continue;

    const twin = byId.get(line.id);
    if (!twin) {
      byId.set(line.id, line);
      continue;
    }
    // two lines that normalised to the same identity: fold them together
    // rather than quietly dropping one and its quantities with it
    const sizes = { ...twin.sizes };
    for (const [size, qty] of Object.entries(line.sizes)) {
      sizes[size] = Math.min((sizes[size] ?? 0) + qty, MAX_QTY_PER_SIZE);
    }
    byId.set(line.id, { ...twin, sizes });
  }

  return [...byId.values()].slice(0, MAX_LINES);
}

/** identity of an off-the-shelf line: same blank, colour and method merge */
function lineId(input: NewLine) {
  return input.design
    ? `d:${input.design.key}`
    : `p:${input.productSlug}:${input.colorSlug}:${input.method}`;
}

export type NewLine = {
  productSlug: string;
  colorSlug: string;
  method: string;
  sizes: Record<string, number>;
  design?: CartDesign;
};

/**
 * Re-point a line at a different colourway or print method.
 *
 * A blank line's id *is* its identity, so switching a black tee to navy can
 * collide with a navy line that is already in the cart. Merging the two is the
 * only answer that keeps one identity to one line — and it deepens the tier,
 * which is what the customer wanted anyway. A design line is keyed by its
 * artwork, so it simply keeps its id.
 */
function revariant(lines: CartLine[], id: string, patch: Partial<CartLine>): CartLine[] {
  const at = lines.findIndex((l) => l.id === id);
  if (at < 0) return lines;

  const updated = normalise({ ...lines[at], ...patch });
  if (!updated) return lines;
  updated.id = lineId(updated);

  const next = lines.filter((_, i) => i !== at);
  const twin = next.findIndex((l) => l.id === updated.id);
  if (twin < 0) {
    next.splice(at, 0, updated);
    return next;
  }

  const sizes = { ...next[twin].sizes };
  for (const [size, qty] of Object.entries(updated.sizes)) {
    sizes[size] = Math.min((sizes[size] ?? 0) + qty, MAX_QTY_PER_SIZE);
  }
  next[twin] = { ...next[twin], sizes };
  return next;
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

type CartState = {
  lines: CartLine[];
  /** false until localStorage has been read — server and first client render must match */
  hydrated: boolean;
  drawerOpen: boolean;
  /** id of the line that was just added, for the highlight in the drawer */
  lastAdded: string | null;

  add: (input: NewLine) => string;
  setSize: (id: string, size: string, qty: number) => void;
  setSizes: (id: string, sizes: Record<string, number>) => void;
  setMethod: (id: string, method: string) => void;
  setColor: (id: string, colorSlug: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  markDesignSaved: (id: string, publicId: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

/**
 * localStorage is not guaranteed: Safari private mode throws on write, and a
 * cart carrying a few mockup thumbnails can hit the 5 MB quota. Neither is a
 * reason to lose the cart in memory, so every access degrades to a no-op.
 */
const safeStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota or a locked-down browser — the session still works */
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* as above */
    }
  },
}));

export const CART_STORAGE_KEY = "inkhaus-cart-v1";

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hydrated: false,
      drawerOpen: false,
      lastAdded: null,

      add: (input) => {
        const id = lineId(input);
        const product = getProduct(input.productSlug);
        if (!product) return id;
        const sizes = cleanSizes(product, input.sizes);
        if (Object.keys(sizes).length === 0) return id;

        const lines = [...get().lines];
        const at = lines.findIndex((l) => l.id === id);

        if (at >= 0) {
          // same blank, same colourway, same method: one line, deeper tier
          const merged = { ...lines[at].sizes };
          for (const [size, qty] of Object.entries(sizes)) {
            merged[size] = Math.min((merged[size] ?? 0) + qty, MAX_QTY_PER_SIZE);
          }
          lines[at] = { ...lines[at], sizes: merged, design: input.design ?? lines[at].design };
        } else {
          if (lines.length >= MAX_LINES) lines.shift();
          lines.push({
            id,
            productSlug: input.productSlug,
            colorSlug: input.colorSlug,
            method: input.method,
            sizes,
            design: input.design,
            addedAt: Date.now(),
          });
        }

        set({ lines: sanitizeLines(lines), lastAdded: id });
        return id;
      },

      setSize: (id, size, qty) => {
        const n = Math.min(Math.max(0, Math.floor(qty || 0)), MAX_QTY_PER_SIZE);
        set({
          lines: get()
            .lines.map((l) => {
              if (l.id !== id) return l;
              const sizes = { ...l.sizes };
              if (n > 0) sizes[size] = n;
              else delete sizes[size];
              return { ...l, sizes };
            })
            // a line emptied size by size is a removal, not a zero-quantity line
            // that `POST /orders` would reject
            .filter((l) => Object.keys(l.sizes).length > 0),
        });
      },

      setSizes: (id, sizes) => {
        set({
          lines: get()
            .lines.map((l) => {
              if (l.id !== id) return l;
              // the run is the line's own product's, so the clean has to happen
              // per line rather than once against a global size list
              const product = getProduct(l.productSlug);
              return product ? { ...l, sizes: cleanSizes(product, sizes) } : l;
            })
            .filter((l) => Object.keys(l.sizes).length > 0),
        });
      },

      setMethod: (id, method) => set({ lines: revariant(get().lines, id, { method }) }),

      setColor: (id, colorSlug) => set({ lines: revariant(get().lines, id, { colorSlug }) }),

      remove: (id) =>
        set({
          lines: get().lines.filter((l) => l.id !== id),
          lastAdded: get().lastAdded === id ? null : get().lastAdded,
        }),

      clear: () => set({ lines: [], lastAdded: null }),

      markDesignSaved: (id, publicId) =>
        set({
          lines: get().lines.map((l) =>
            l.id === id && l.design ? { ...l, design: { ...l.design, publicId } } : l,
          ),
        }),

      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false, lastAdded: null }),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      storage: safeStorage,
      // the drawer is UI, not inventory — reopening it on a reload would be rude
      partialize: (s) => ({ lines: s.lines }),
      // Next renders this on the server with an empty cart. Rehydrating during
      // module evaluation would make the first client render disagree with that
      // HTML, so CartRoot triggers it from an effect instead.
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        lines: sanitizeLines(((persisted as { lines?: CartLine[] } | null)?.lines ?? []) as CartLine[]),
      }),
      onRehydrateStorage: () => () => useCart.setState({ hydrated: true }),
    },
  ),
);

/* ------------------------------------------------------------------ *
 * Selectors — every one returns a stable value, so components that read a
 * number do not re-render when an unrelated line changes.
 * ------------------------------------------------------------------ */

export const selectCount = (s: CartState) =>
  s.lines.reduce((n, l) => n + Object.values(l.sizes).reduce((a, b) => a + b, 0), 0);

export const selectLineCount = (s: CartState) => s.lines.length;

/** resolved lines + totals; recomputed on read, which is cheap at cart sizes */
export function readCart(lines: CartLine[]) {
  const resolved = lines.map(resolveLine).filter((l): l is ResolvedLine => l !== null);
  return { lines: resolved, totals: cartTotals(resolved) };
}

export { SIZE_UPCHARGE, FREE_SHIPPING_OVER, SHIPPING_FLAT };
