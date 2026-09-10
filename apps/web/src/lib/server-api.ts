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
 * Errors that prove the request never reached the API: nothing was listening on
 * the port, or the name did not resolve. Since the API cannot have acted on a
 * request it never received, replaying one is not a duplicate - which is what
 * makes the retry below safe even for a POST. `POST /orders` is exactly why the
 * ambiguous codes are kept out of this set.
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
 * What a shopper sees when the API is unreachable. An errno means nothing to
 * them and the base URL is not theirs to know, so it rides along in development
 * only - where it is the whole answer - and never in production.
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
 * The attempts exist for sign-in. The Google callback fires after the shopper
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
      `[web api] ${method} ${url} failed: ${code ?? (lastErr as Error)?.name ?? lastErr}`,
    );
    throw new ApiError(0, timedOut ? "The API took too long to answer." : unreachable(code));
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
