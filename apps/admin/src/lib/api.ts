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
 * Errors that prove the request never reached the API: nothing was listening on
 * the port, or the name did not resolve. Since the API cannot have acted on a
 * request it never received, replaying one is not a duplicate - which is what
 * makes the retry below safe even for a POST.
 */
const NEVER_SENT = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);

/** Ambiguous: the API may already have acted, so only replay idempotent calls. */
const MAYBE_SENT = new Set(["ECONNRESET", "UND_ERR_SOCKET"]);

/** `fetch` rejects with a bare TypeError; the errno is on its `cause`. */
function errorCode(err: unknown) {
  return (err as { cause?: { code?: string } } | null)?.cause?.code;
}

function isRetryable(err: unknown, method: string) {
  const code = errorCode(err);
  if (!code) return false; // a timeout is not a connection failure - see below
  if (NEVER_SENT.has(code)) return true;
  return MAYBE_SENT.has(code) && (method === "GET" || method === "HEAD");
}

/**
 * What staff see when the API is unreachable. The errno is meaningless to them
 * but is the whole answer for whoever is running the stack, so it rides along
 * in development - where "the API is not up yet" is the everyday cause - and is
 * dropped in production, which has logs instead.
 */
function unreachable(code: string | undefined) {
  const plain = "Could not reach the INKHAUS API.";
  if (process.env.NODE_ENV === "production" || !code) return plain;
  return `${plain} (${code} at ${BASE} - is it running?)`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One call to the API, always from the server, always with the caller's own
 * session token. Nothing here is cached: an order list that is one revalidation
 * behind is worse than no order list.
 *
 * The attempts exist for sign-in. The Google callback fires after the operator
 * has been away on a consent screen, which is easily long enough for a dev API
 * to have bounced under `nest start --watch`; without a retry that race costs
 * them the entire round trip through Google for a gap of a second or two.
 */
async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const token = opts.token ?? (await readToken());
  const url = `${BASE}${path}`;
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);

  let res: Response | undefined;
  let lastErr: unknown;

  for (let attempt = 0; attempt < 3 && !res; attempt++) {
    if (attempt > 0) await sleep(150 * attempt);
    try {
      res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body,
        cache: "no-store",
        // a fresh signal per attempt: an aborted one stays aborted
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err, method)) break;
    }
  }

  if (!res) {
    const timedOut = (lastErr as Error)?.name === "TimeoutError";
    const code = errorCode(lastErr);
    // The one place this failure used to be silent. Without it, "Could not
    // reach the INKHAUS API" is a dead end: a refused port, a bad
    // API_INTERNAL_URL and broken DNS all look identical from the login page.
    console.error(
      `[admin api] ${method} ${url} failed: ${code ?? (lastErr as Error)?.name ?? lastErr}`,
    );
    throw new ApiError(0, timedOut ? "The API took too long to answer." : unreachable(code));
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
  /**
   * Hands Google's id_token to the API, which verifies its signature against
   * Google's JWKS itself. The admin app is never trusted to vouch for an
   * identity - it only drives the browser end of the flow.
   */
  loginWithGoogle: (idToken: string) =>
    request<{ token: string; expiresAt: string; user: AdminUser }>("/admin/auth/google", {
      method: "POST",
      body: { idToken },
      // no session cookie exists yet at this point
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
