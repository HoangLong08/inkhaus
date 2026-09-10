import "server-only";

import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "./api";
import { HttpError } from "./api-guard";

/**
 * Upstream statuses that describe the CALLER's request rather than the API's
 * internals, so the API's own wording is safe - and useful - to pass along.
 * "Only an owner can cancel an order" is the whole answer; replacing it with
 * "Request failed" helps nobody.
 */
const PASS_THROUGH = new Set([400, 401, 403, 404, 409, 422, 429]);

export function toErrorResponse(err: unknown): NextResponse {
  // Never swallow NEXT_REDIRECT / NEXT_NOT_FOUND: those are control flow, not
  // failures, and catching them silently breaks notFound() inside a handler.
  unstable_rethrow(err);

  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
  }

  if (err instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "That request did not make sense.",
        detail: err.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
      },
      { status: 400 },
    );
  }

  if (err instanceof ApiError) {
    // status 0 is this app's marker for "the request never reached the API"
    if (err.status === 0) {
      console.error("[admin bff] upstream unreachable:", err.message);
      return NextResponse.json({ error: "Could not reach the INKHAUS API." }, { status: 503 });
    }
    if (PASS_THROUGH.has(err.status)) {
      return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
    }
    // A 5xx message is about the API's internals. Staff get the fact, logs get
    // the rest, and nothing about our deployment crosses the wire.
    console.error(`[admin bff] upstream ${err.status}: ${err.message}`);
    return NextResponse.json({ error: "The INKHAUS API failed." }, { status: 502 });
  }

  console.error("[admin bff] unexpected:", err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/**
 * Wraps a handler so every throw above becomes a JSON response instead of Next's
 * HTML error page. Without it a single unguarded `throw` hands the browser a
 * document where the client expects `{ error }`.
 */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
