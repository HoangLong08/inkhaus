import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { adminApi, ApiError, type AdminUser } from "./api";
import { readToken } from "./session";

/**
 * The real authorization check.
 *
 * `proxy.ts` only looks at whether a cookie exists, which the Next docs are
 * explicit about being an optimistic check and not a defense. This is the one
 * that asks the API whether the token is still a live session, and every page
 * behind /(dash) calls it. Wrapped in React's `cache` so a layout and its page
 * hitting it in the same render cost one round trip, not two.
 */
export const verifySession = cache(async (): Promise<AdminUser | null> => {
  const token = await readToken();
  if (!token) return null;

  try {
    return await adminApi.me(token);
  } catch (err) {
    // 401 means the session was revoked or expired. Anything else (API down,
    // 500) is not the operator's fault, but there is no safe way to render a
    // back office without knowing who is asking, so both end at the login page.
    if (!(err instanceof ApiError)) throw err;
    return null;
  }
});

/** use in any layout, page or action that must not render for a stranger */
export async function requireAdmin() {
  const user = await verifySession();
  if (!user) redirect("/login");
  return user;
}
