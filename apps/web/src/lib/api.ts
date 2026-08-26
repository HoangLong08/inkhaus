import type { Clip, Product } from "@inkhaus/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return get<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/** Typed client for the NestJS API. Server components can call these directly. */
export const api = {
  products: () => get<Product[]>("/catalog/products"),
  product: (slug: string) => get<Product>(`/catalog/products/${slug}`),
  colors: () => get<{ slug: string; name: string; hex: string; dark?: boolean }[]>("/catalog/colors"),
  sizes: () => get<{ code: string; label: string; upcharge: number }[]>("/catalog/sizes"),
  tiers: () => get<{ min: number; off: number }[]>("/catalog/price-tiers"),

  clipart: (q?: string) => get<Clip[]>(`/assets/clipart${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  fonts: () => get<{ label: string; css: string }[]>("/assets/fonts"),
  inks: () => get<{ name: string; hex: string }[]>("/assets/ink-colors"),

  quote: (slug: string, items: { size: string; qty: number }[], withTotals = false) =>
    post<import("@inkhaus/shared").Quote & { totals?: Record<string, number> }>("/pricing/quote", {
      slug,
      items,
      withTotals,
    }),

  saveDesign: (body: {
    productSlug: string;
    colorSlug?: string;
    name?: string;
    scene: Record<string, unknown>;
    previewFront?: string;
    previewBack?: string;
    email?: string;
  }) => post<{ publicId: string }>("/designs", body),

  design: (publicId: string) => get<{ publicId: string; scene: unknown }>(`/designs/${publicId}`),

  placeOrder: (body: unknown) => post<{ number: string; total: number }>("/orders", body),
  order: (number: string) => get<{ number: string; status: string }>(`/orders/${number}`),

  bulkQuote: (body: { email: string; quantity: number; productSlug?: string; message?: string }) =>
    post<{ id: string; estimated: number | null }>("/bulk-quotes", body),

  reviews: (product?: string) =>
    get<{ author: string; handle: string | null; body: string }[]>(
      `/reviews${product ? `?product=${product}` : ""}`,
    ),
};
