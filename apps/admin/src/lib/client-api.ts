import { z } from "zod";

import {
  adminUserSchema,
  bulkQuoteSchema,
  orderSchema,
  paginatedSchema,
} from "./schemas/api";
import type { OrderStatusInput, QuoteStatusInput } from "./schemas/forms";
import type { OrdersQuery, QuotesQuery } from "./schemas/params";

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
 * The only module in this app that calls `fetch` from a browser, and every path
 * it touches is relative. That is the whole point: the request goes to this
 * app's own origin, a route handler under /api/admin reads the httpOnly session
 * cookie, and the INKHAUS API is reached server to server. The browser never
 * holds a token and never learns the API's address.
 *
 * Generic over the SCHEMA rather than its output - see paginatedSchema for why.
 */
async function call<S extends z.ZodType>(
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

/** same rules as the server-side helper in api.ts: drop empties, keep order */
function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const clientApi = {
  me: () => call("/me", adminUserSchema),

  orders: (params: OrdersQuery) =>
    call(`/orders${query(params)}`, paginatedSchema(orderSchema)),

  order: (number: string) => call(`/orders/${encodeURIComponent(number)}`, orderSchema),

  setOrderStatus: (number: string, input: OrderStatusInput) =>
    call(`/orders/${encodeURIComponent(number)}/status`, orderSchema, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  quotes: (params: QuotesQuery) =>
    call(`/quotes${query(params)}`, paginatedSchema(bulkQuoteSchema)),

  setQuoteStatus: (id: string, input: QuoteStatusInput) =>
    call(`/quotes/${encodeURIComponent(id)}`, bulkQuoteSchema, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};
