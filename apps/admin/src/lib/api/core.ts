import "server-only";

import { z } from "zod";

import { readToken } from "@/lib/session";

/**
 * The transport every `adminApi` call goes through. FROZEN after Phase 0: a
 * feature adds calls to its own file beside this one, never a second fetch.
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
    /* an HTML error page is not worth quoting back at staff */
  }
  const raw = (body as { message?: string | string[] } | null)?.message;
  const detail = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return new ApiError(res.status, detail[0] ?? `${method} ${path} failed: ${res.status}`, detail);
}

type SendOptions = {
  method?: string;
  body?: unknown;
  /** defaults to the caller's session cookie; `""` sends no token at all */
  token?: string;
  headers?: Record<string, string>;
  /** covers the whole response, body included - see requestRaw */
  timeoutMs?: number;
};

type Options<S extends z.ZodType> = SendOptions & {
  /**
   * Optional because `request` also serves the two auth endpoints, whose shapes
   * are ad hoc. Everything that reaches a page passes one.
   */
  schema?: S;
};

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
 *
 * Resolves with the Response whatever its status; the two callers below decide
 * what a non-2xx means.
 */
async function send(path: string, opts: SendOptions): Promise<Response> {
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
          ...opts.headers,
        },
        body,
        cache: "no-store",
        // a fresh signal per attempt: an aborted one stays aborted
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
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

  return res;
}

/** a JSON call, parsed with `schema` before anything downstream sees it */
export async function request<S extends z.ZodType>(
  path: string,
  opts: Options<S> = {},
): Promise<z.infer<S>> {
  const method = opts.method ?? "GET";
  const res = await send(path, opts);

  if (!res.ok) throw await readError(res, path, method);
  if (res.status === 204) return undefined as z.infer<S>;

  const json: unknown = await res.json();
  if (!opts.schema) return json as z.infer<S>;

  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    // The API changed shape under us. Staff get a fact they can report; the
    // issue list is for whoever ships the API, and a raw zod dump rendered at
    // someone triaging orders would be worse than useless. 502 because this is
    // an upstream fault, not the caller's.
    console.error(
      `[admin api] ${method} ${path} response did not match:`,
      JSON.stringify(z.treeifyError(parsed.error)),
    );
    throw new ApiError(502, "The INKHAUS API returned something unexpected.");
  }
  return parsed.data;
}

/**
 * The upstream Response itself, body unread, for what must not be buffered and
 * is not JSON - a CSV export, an image. A route handler hands `res.body` straight
 * to its own Response, so a 10,000-row export streams through instead of sitting
 * in memory.
 *
 * A non-2xx still throws ApiError, so `route()` answers with the usual JSON
 * error rather than piping an error page into a download. The default timeout is
 * longer than `request`'s because it covers the whole body, not just the
 * headers. Only what YOU forward reaches the browser: copy the content type and
 * disposition you mean to send, never the upstream headers wholesale.
 */
export async function requestRaw(path: string, opts: SendOptions = {}): Promise<Response> {
  const method = opts.method ?? "GET";
  const res = await send(path, { timeoutMs: 120_000, ...opts });
  if (!res.ok) throw await readError(res, path, method);
  return res;
}

export type QueryValue = string | number | boolean | null | undefined;

/** `?a=1&b=2` from a params object, dropping empties and keeping key order */
export function query(params: Record<string, QueryValue>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
