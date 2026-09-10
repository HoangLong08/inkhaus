import { z } from "zod";

/**
 * FROZEN after Phase 0. Feature files beside this one build their calls from
 * `call` and `query`; none of them calls `fetch` itself.
 */

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: string[] = [],
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

/**
 * The only function in this app that calls `fetch` from a browser, and every
 * path it touches is relative. That is the whole point: the request goes to this
 * app's own origin, a route handler under /api/admin reads the httpOnly session
 * cookie, and the INKHAUS API is reached server to server. The browser never
 * holds a token and never learns the API's address.
 *
 * `path` is relative to /api/admin. Generic over the SCHEMA rather than its
 * output - see paginatedSchema for why.
 */
export async function call<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    // the httpOnly session cookie rides along; no token is ever in JS
    credentials: "same-origin",
    cache: "no-store",
  });

  if (res.status === 401) {
    // The session died while this tab sat open. Send them where the layout would
    // have, rather than leaving an empty table and a puzzling error toast.
    //
    // A full document load rather than router.push, and not only because this is
    // a plain module with no router to reach for: a dead session should take the
    // query cache and every piece of rendered state with it, which is exactly
    // what a fresh document does and a client-side navigation does not.
    const next = encodeURIComponent(location.pathname + location.search);
    location.assign(`/login?next=${next}`);
    throw new ClientApiError(401, "Your session has expired.");
  }

  const body = (await res.json().catch(() => null)) as {
    error?: string;
    detail?: string[];
  } | null;

  if (!res.ok) {
    throw new ClientApiError(
      res.status,
      body?.error ?? `Request failed (${res.status}).`,
      body?.detail ?? [],
    );
  }

  return schema.parse(body);
}

/** `JSON.stringify` for a request body, so a feature file never builds `init` by hand */
export function json(method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): RequestInit {
  return { method, body: body === undefined ? undefined : JSON.stringify(body) };
}

/** same rules as the server-side helper in lib/api/core.ts: drop empties, keep order */
export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
