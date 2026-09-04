import "server-only";

import type { OrderDto } from "./api";
import { readToken } from "./session";

/**
 * The server-side half of the storefront's API access, and separate from
 * `lib/api.ts` on purpose.
 *
 * `lib/api.ts` runs in the browser against `NEXT_PUBLIC_API_URL` and carries no
 * credential. Everything here carries the session token, which must never be
 * inlined into a client bundle - hence `server-only`, `API_INTERNAL_URL`
 * (server-to-server, no NEXT_PUBLIC_ prefix), and a separate module a client
 * component cannot import by accident.
 */
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
    /* an HTML error page is not worth quoting back at a shopper */
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

/** mirrors `toDto` in the API's CustomerAuthService - note there is no `id` */
export type Customer = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  company: string | null;
};

export type Session = { token: string; expiresAt: string; customer: Customer };

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};

/* ----------------------------------------------------------------- calls */

export const accountApi = {
  /**
   * `token: ""` means "send no Authorization header", not "send an empty one".
   * Without it `request` would fall back to reading the session cookie, and
   * signing in while already signed in would attach a stale token to the very
   * call that is meant to replace it.
   */
  loginWithGoogle: (idToken: string) =>
    request<Session>("/auth/google", { method: "POST", body: { idToken }, token: "" }),

  me: (token: string) => request<Customer>("/auth/me", { token }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  myOrders: (page = 1, limit = 20) =>
    request<Paginated<OrderDto>>(`/orders/mine?page=${page}&limit=${limit}`),
};
