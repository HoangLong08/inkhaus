import "server-only";

import type { AdminUser } from "./api";
import { verifySession } from "./dal";

/** an error that already knows what HTTP status a route handler should answer with */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: string[] = [],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * The route-handler twin of `requireAdmin()`.
 *
 * It exists because `requireAdmin()` calls `redirect()`, and a redirect inside a
 * Route Handler is a 307 to an HTML page. `fetch()` follows it, gets a 200 with
 * a login page in the body, and reports success right up until `res.json()`
 * throws a SyntaxError three layers away from the actual problem. A JSON caller
 * needs a status it can act on.
 *
 * Same `verifySession()` underneath, React-cached the same way, so this is the
 * same check asking the API whether the token is still live - only the failure
 * mode differs.
 */
export async function requireAdminApi(): Promise<AdminUser> {
  const user = await verifySession();
  if (!user) throw new HttpError(401, "Your session has expired.");
  return user;
}

/**
 * Convenience for the UI, not the defence - the API enforces the same rule with
 * `@Roles('OWNER')`. Unused by the handlers here because owner-only-ness in this
 * app is per status value rather than per route (see canSetStatus), but the
 * owner-only designs endpoints are the obvious next BFF route.
 */
export async function requireOwnerApi(): Promise<AdminUser> {
  const user = await requireAdminApi();
  if (user.role !== "OWNER") throw new HttpError(403, "Owners only.");
  return user;
}
