import "server-only";
import { cookies } from "next/headers";

export const COOKIE_NAME = process.env.WEB_SESSION_COOKIE_NAME ?? "inkhaus_session";

/**
 * The session cookie is set by THIS app on ITS OWN origin, not by the API.
 *
 * Same backend-for-frontend shape as the back office, and for the same reason:
 * the API token never reaches page scripts, so no storefront credential exists
 * in the browser at all. `CORS_ORIGIN` needs no entry for the auth routes -
 * every call that carries this token is server-to-server.
 *
 * Distinct from the admin cookie name on purpose. The two apps share
 * `localhost` in development, cookies are not scoped by port, and a shared name
 * would mean signing into the storefront quietly signed you out of the back
 * office.
 */
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** `cookies()` is async in Next 16 - every caller must await it */
export async function readToken() {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

export async function startSession(token: string, expiresAt: string | Date) {
  (await cookies()).set(COOKIE_NAME, token, {
    ...options,
    expires: new Date(expiresAt),
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}
