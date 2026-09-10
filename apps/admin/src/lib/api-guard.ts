import "server-only";

import { can, type AdminAction } from "@inkhaus/shared/admin";

import type { AdminUser } from "@/lib/api";
import { verifySession } from "@/lib/dal";

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
 * The BFF third of the capability rule: the UI hides a control with `can()`,
 * this refuses it with a 403, and the API refuses it again with `@Can`. All
 * three read `ADMIN_CAPABILITIES` in `@inkhaus/shared/admin`, which is the only
 * reason they cannot disagree.
 *
 * Use it in place of `requireAdminApi()` in every handler that reaches a
 * feature endpoint - it is the same session check plus the table lookup.
 */
export async function requireCapability(action: AdminAction): Promise<AdminUser> {
  const user = await requireAdminApi();
  if (!can(user.role, action)) throw new HttpError(403, "You do not have access to this.");
  return user;
}
