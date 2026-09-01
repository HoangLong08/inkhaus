import "server-only";
import { cookies } from "next/headers";

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "inkhaus_admin";

/**
 * The session cookie is set by THIS app on ITS OWN origin, not by the API.
 *
 * The alternative - letting NestJS set a cookie for admin.<domain> - needs
 * `Domain=.<domain>` plus `SameSite=None`, which breaks on localhost and is at
 * the mercy of every browser's third-party cookie policy. Here the cookie is
 * plain first-party, and the API token it carries is only ever read on the
 * server, so no admin credential exists in the browser at all.
 */
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  // no `domain`: keep the cookie pinned to the admin host, never shared with
  // the storefront or any other subdomain
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
