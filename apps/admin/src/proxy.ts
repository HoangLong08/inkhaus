import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME } from "@/lib/session";

/**
 * `proxy.ts`, not `middleware.ts` - the middleware convention is deprecated as
 * of Next 16 and this is its replacement.
 *
 * Two jobs, both cheap and both before any render:
 *
 * 1. CSRF on every write to the BFF - see `refuseCrossSiteWrite` below.
 * 2. An OPTIMISTIC sign-in check: it saves a render for a visitor with no
 *    cookie at all. It deliberately does not call the API - the Next docs warn
 *    against treating the proxy as session management, and a token that is
 *    present but revoked still has to be caught by requireAdmin() in the (dash)
 *    layout.
 */
export function proxy(request: NextRequest) {
  const refused = refuseCrossSiteWrite(request);
  if (refused) return refused;

  if (request.cookies.has(COOKIE_NAME)) return NextResponse.next();

  // A fetch() from the dashboard needs a status it can act on. Redirecting it to
  // /login hands it a 200 with an HTML body - `res.ok` is true and the failure
  // only surfaces when res.json() throws, far from the actual cause. The BFF
  // handlers under /api/admin do the real check themselves and answer 401 too;
  // this is the same answer for the case where no cookie exists at all.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  // so a bookmarked deep link still lands where it was going after signing in
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

const READS = new Set(["GET", "HEAD"]);
const WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/**
 * The session cookie is SameSite=Lax, which keeps it off a request from another
 * SITE - but not off one from another origin on the same site, and every port
 * of localhost, like every subdomain in production, is the same site as this
 * one. From such a page a hidden `<form method="post" enctype="text/plain">`
 * is a simple request: no preflight, the cookie attached, and a route handler
 * that reads `request.json()` would accept its body - an invitation for a new
 * OWNER, say. So a write to `/api/admin/*`:
 *
 * - is refused (403) unless `Sec-Fetch-Site` says `same-origin`, when the
 *   browser sent that header at all - every current one does;
 * - otherwise is refused (403) if it carries an `Origin` other than this
 *   app's own - what an older browser sends instead;
 * - passes when it carries neither, which is a client that is not a browser
 *   (a script, the e2e suite's own request context) and so holds no
 *   ambient cookie to abuse;
 * - and, for a method with a body, is refused (415) unless it is JSON, which is
 *   the one content type a page cannot send cross-origin without a preflight.
 *
 * Refusals are JSON `{ error }` like every other BFF answer, never a redirect.
 * The login form's POST to `/api/auth/google/*` is not under `/api/admin`, and
 * the matcher skips it anyway. Server Actions (`logout`) have Next's own Origin
 * check.
 */
function refuseCrossSiteWrite(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/api/admin/")) return null;
  if (READS.has(request.method)) return null;

  const fetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const crossSite =
    fetchSite !== null ? fetchSite !== "same-origin" : origin !== null && !isOwnOrigin(origin, request);
  if (crossSite) {
    return NextResponse.json(
      { error: "Writes to the back office must come from the back office itself." },
      { status: 403 },
    );
  }

  if (WITH_BODY.has(request.method)) {
    const type = request.headers.get("content-type")?.trim().toLowerCase() ?? "";
    if (!type.startsWith("application/json")) {
      return NextResponse.json({ error: "Send the request body as JSON." }, { status: 415 });
    }
  }

  return null;
}

/**
 * The request's own origin - or, behind a reverse proxy that rewrites Host,
 * the host the browser addressed, which is how Next checks a Server Action's
 * Origin too. `null` (a sandboxed frame, a privacy redirect) is not an origin
 * and never matches.
 */
function isOwnOrigin(origin: string, request: NextRequest) {
  let claimed: URL;
  try {
    claimed = new URL(origin);
  } catch {
    return false;
  }
  if (claimed.origin === request.nextUrl.origin) return true;

  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
    ?.split(",")[0]
    ?.trim();
  return !!host && claimed.host === host;
}

export const config = {
  // Everything except the login page, the OAuth routes, Next's own assets, the
  // app icons and robots.txt. Excluding /login matters: redirecting it would
  // loop for anyone without a cookie. /api/auth/google matters more: the
  // callback is precisely the request that arrives *without* a session cookie
  // and whose job is to create one - proxying it away would make signing in
  // impossible. robots.txt has to stay reachable or a crawler is told to sign in
  // instead of go away. icon.svg and apple-icon.png are the file-convention
  // icons in src/app, served at exactly those paths: without them here the one
  // page a visitor with no cookie ever sees - /login - is the one page with no
  // icon, and every request for it costs a 307 to /login?next=%2Ficon.svg.
  matcher: [
    "/((?!login|api/auth/google|robots.txt|icon.svg|apple-icon.png|_next/static|_next/image|favicon.ico).*)",
  ],
};
