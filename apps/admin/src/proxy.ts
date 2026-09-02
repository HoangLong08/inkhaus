import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME } from "@/lib/session";

/**
 * `proxy.ts`, not `middleware.ts` - the middleware convention is deprecated as
 * of Next 16 and this is its replacement.
 *
 * This is an OPTIMISTIC check only: it saves a render for a visitor with no
 * cookie at all. It deliberately does not call the API - the Next docs warn
 * against treating the proxy as session management, and a token that is present
 * but revoked still has to be caught by requireAdmin() in the (dash) layout.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE_NAME)) return NextResponse.next();

  const login = new URL("/login", request.url);
  // so a bookmarked deep link still lands where it was going after signing in
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, the OAuth routes, Next's own assets, and
  // robots.txt. Excluding /login matters: redirecting it would loop for anyone
  // without a cookie. /auth/google matters more: the callback is precisely the
  // request that arrives *without* a session cookie and whose job is to create
  // one - proxying it away would make signing in impossible. robots.txt has to
  // stay reachable or a crawler is told to sign in instead of to go away.
  matcher: ["/((?!login|auth/google|robots.txt|_next/static|_next/image|favicon.ico).*)"],
};
