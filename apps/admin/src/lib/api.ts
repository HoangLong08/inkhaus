import "server-only";

import { readToken } from "./session";

const BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api/v1";

/** thrown by every helper below; `status` mirrors the API's own */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** the API answers `{ statusCode, message: string | string[] }` */
async function readError(res: Response, path: string, method: string) {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* an HTML error page is not worth quoting back at staff */
  }
  const raw = (body as { message?: string | string[] } | null)?.message;
  const detail = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return new ApiError(res.status, detail[0] ?? `${method} ${path} failed: ${res.status}`, detail);
}

type Options = { method?: string; body?: unknown; token?: string };

/**
 * One call to the API, always from the server, always with the caller's own
 * session token. Nothing here is cached: an order list that is one revalidation
 * behind is worse than no order list.
 */
async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const token = opts.token ?? (await readToken());

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new ApiError(
      0,
      (err as Error)?.name === "TimeoutError"
        ? "The API took too long to answer."
        : "Could not reach the INKHAUS API.",
    );
  }

  if (!res.ok) throw await readError(res, path, method);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ shapes */

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "OWNER" | "STAFF";
  lastLoginAt: string | null;
};

export type OrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type QuoteStatus = "NEW" | "CONTACTED" | "WON" | "LOST";

/** mirrors OrdersService.toDto in apps/api */
export type Order = {
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

/** mirrors QuotesService.toDto in apps/api */
export type BulkQuote = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  productSlug: string | null;
  quantity: number;
  method: string | null;
  message: string | null;
  estimated: number | null;
  status: QuoteStatus;
  createdAt: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};

/* ------------------------------------------------------------------- calls */

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ token: string; expiresAt: string; user: AdminUser }>("/admin/auth/login", {
      method: "POST",
      body: { email, password },
      // no cookie exists yet at this point
      token: "",
    }),

  me: (token?: string) => request<AdminUser>("/admin/auth/me", { token }),

  logout: () => request<{ ok: true }>("/admin/auth/logout", { method: "POST" }),

  orders: (params: { page?: number; status?: OrderStatus; email?: string } = {}) =>
    request<Paginated<Order>>(`/orders${query(params)}`),

  order: (number: string) => request<Order>(`/orders/${encodeURIComponent(number)}`),

  setOrderStatus: (number: string, status: OrderStatus, note?: string) =>
    request<Order>(`/orders/${encodeURIComponent(number)}/status`, {
      method: "PATCH",
      body: { status, ...(note ? { note } : {}) },
    }),

  quotes: (params: { page?: number; status?: QuoteStatus } = {}) =>
    request<Paginated<BulkQuote>>(`/bulk-quotes${query(params)}`),

  setQuoteStatus: (id: string, status: QuoteStatus) =>
    request<BulkQuote>(`/bulk-quotes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
    }),
};

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
