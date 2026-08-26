import type { Clip, Product } from "@inkhaus/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** the API is not always up — the storefront renders from `@inkhaus/shared` regardless */
const TIMEOUT_MS = 12_000;

/**
 * A failed call, with the server's own words attached.
 *
 * Nest's validation pipe answers `{ statusCode, message: string | string[] }`,
 * and checkout is the one screen where that detail matters: "Heavyweight Tee is
 * not stocked in acid" is actionable, "POST /orders failed: 400" is not.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** no response at all — server down, DNS, CORS, offline */
  get isNetwork() {
    return this.status === 0;
  }
}

async function readError(res: Response, path: string, method: string): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* an HTML error page or an empty body is not worth reporting verbatim */
  }
  const raw = (body as { message?: string | string[] } | null)?.message;
  const detail = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const message = detail[0] ?? `${method} ${path} failed: ${res.status}`;
  return new ApiError(res.status, message, detail);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(
      0,
      (err as Error)?.name === "TimeoutError"
        ? "The server took too long to answer. Check your connection and try again."
        : "Could not reach the INKHAUS server. Check your connection and try again.",
    );
  }
  if (!res.ok) throw await readError(res, path, method);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string, init?: RequestInit) => request<T>(path, init);
const post = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(path, { ...init, method: "POST", body: JSON.stringify(body) });

/* ---------------- order shapes, mirroring OrdersService.toDto ---------------- */

export type OrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type OrderDto = {
  number: string;
  status: OrderStatus;
  currency: string;
  customer: { email: string; name: string | null };
  items: {
    productSlug: string;
    productName: string;
    color: { slug: string; name: string; hex: string };
    method: string;
    designId: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    sizes: { size: string; qty: number; upcharge: number }[];
  }[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal: string | null;
    country: string | null;
  };
  notes: string | null;
  timeline: { status: OrderStatus; note: string | null; at: string }[];
  placedAt: string | null;
  createdAt: string;
};

/** the enum names Prisma stores, keyed by the labels the storefront shows */
export type PrintMethodEnum = "DTG" | "SCREEN_PRINT" | "EMBROIDERY" | "PUFF" | "LEATHER_PATCH";

export type PlaceOrderBody = {
  customer: { email: string; name?: string; phone?: string; company?: string };
  items: {
    productSlug: string;
    colorSlug: string;
    method: PrintMethodEnum;
    designId?: string;
    sizes: { size: string; qty: number }[];
  }[];
  shipping?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
  };
  notes?: string;
};

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

  placeOrder: (body: PlaceOrderBody) => post<OrderDto>("/orders", body),
  order: (number: string) => get<OrderDto>(`/orders/${encodeURIComponent(number)}`),

  bulkQuote: (body: { email: string; quantity: number; productSlug?: string; message?: string }) =>
    post<{ id: string; estimated: number | null }>("/bulk-quotes", body),

  reviews: (product?: string) =>
    get<{ author: string; handle: string | null; body: string }[]>(
      `/reviews${product ? `?product=${product}` : ""}`,
    ),
};
