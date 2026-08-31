/**
 * Filtering and sorting for /products.
 *
 * Kept pure and DOM-free so it can be unit tested and so the browser component
 * above it stays about URL state and markup. Everything is derived from the
 * catalog rather than hard-coded, so a new category or print method shows up in
 * the filter bar the moment a product uses it.
 */
import { CATEGORIES, COLORS, PRODUCTS, type Product, type ProductCategory } from "@/lib/catalog";

export const SORTS = {
  featured: "Featured",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
  "bulk-asc": "Best at 50+",
  name: "Name, A–Z",
} as const;

export type SortKey = keyof typeof SORTS;

export type FilterState = {
  q: string;
  cat: ProductCategory | "";
  color: string;
  method: string;
  sort: SortKey;
};

export const EMPTY: FilterState = { q: "", cat: "", color: "", method: "", sort: "featured" };

/** categories that actually have stock, in the catalog's own order */
export function activeCategories(products: Product[] = PRODUCTS): ProductCategory[] {
  const used = new Set(products.map((p) => p.category));
  return CATEGORIES.filter((c) => used.has(c));
}

/** every print method any product offers, first-seen order */
export function activeMethods(products: Product[] = PRODUCTS): string[] {
  const out: string[] = [];
  for (const p of products) for (const m of p.method) if (!out.includes(m)) out.push(m);
  return out;
}

/** every colourway key any product stocks, in COLORS order */
export function activeColorKeys(products: Product[] = PRODUCTS): string[] {
  const hexes = new Set(products.flatMap((p) => p.colors.map((c) => c.hex.toLowerCase())));
  return Object.entries(COLORS)
    .filter(([, c]) => hexes.has(c.hex.toLowerCase()))
    .map(([key]) => key);
}

export function countFor(products: Product[], cat: ProductCategory): number {
  return products.filter((p) => p.category === cat).length;
}

function matchesQuery(p: Product, q: string): boolean {
  if (!q) return true;
  // name, blurb, fabric and the method labels — searching "embroidery" or
  // "fleece" should find things, not just an exact product name
  const hay = [p.name, p.blurb, p.fabric, p.tag ?? "", p.type, p.category, ...p.method]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export function filterProducts(products: Product[], f: FilterState): Product[] {
  return products.filter((p) => {
    if (f.cat && p.category !== f.cat) return false;
    if (f.method && !p.method.includes(f.method)) return false;
    if (f.color) {
      const hex = COLORS[f.color]?.hex.toLowerCase();
      if (!hex || !p.colors.some((c) => c.hex.toLowerCase() === hex)) return false;
    }
    return matchesQuery(p, f.q);
  });
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const out = [...products];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    case "price-desc":
      return out.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    case "bulk-asc":
      return out.sort((a, b) => a.bulkPrice - b.bulkPrice || a.name.localeCompare(b.name));
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    // "featured" is the catalog's own order — the sequence in PRODUCTS is a
    // merchandising decision, so it is preserved rather than re-derived
    default:
      return out;
  }
}

export function applyFilters(products: Product[], f: FilterState): Product[] {
  return sortProducts(filterProducts(products, f), f.sort);
}

export function activeCount(f: FilterState): number {
  return [f.q, f.cat, f.color, f.method].filter(Boolean).length;
}

/* ------------------------------------------------------- URL round-trip */

const SORT_KEYS = Object.keys(SORTS) as SortKey[];

export function parseFilters(sp: URLSearchParams | Record<string, string | undefined>): FilterState {
  const get = (k: string) =>
    (sp instanceof URLSearchParams ? sp.get(k) : sp[k]) ?? "";

  const cat = get("cat");
  const sort = get("sort");
  return {
    q: get("q").slice(0, 80),
    cat: (CATEGORIES as string[]).includes(cat) ? (cat as ProductCategory) : "",
    color: COLORS[get("color")] ? get("color") : "",
    method: get("method"),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "featured",
  };
}

/** only non-default values, so a pristine view has a clean /products URL */
export function toQuery(f: FilterState): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.cat) sp.set("cat", f.cat);
  if (f.color) sp.set("color", f.color);
  if (f.method) sp.set("method", f.method);
  if (f.sort !== "featured") sp.set("sort", f.sort);
  return sp.toString();
}
