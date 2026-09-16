/**
 * The two languages the back office is drawn in, and the cookie that remembers
 * which one you picked. Deliberately dependency-free and free of `server-only`:
 * `request.ts` imports it before anything else exists, the route handler that
 * writes the cookie imports it, and so does the zod schema that guards that
 * handler. A module this early in the graph earns nothing by being clever.
 *
 * There is NO locale in the URL. This app is a staff tool on its own origin that
 * is never indexed (s5, s7), so a `/vi` prefix would buy no SEO and cost every
 * href in the app - `hrefWith()` in lib/url.ts and every list control built on
 * it. The locale lives in a cookie and is read once per request in request.ts.
 */

export const LOCALES = ["en", "vi"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English, not Vietnamese. A first-ever visitor has no cookie yet and cannot set
 * one before signing in (s5: the proxy answers 401 to a write with no session),
 * so this is what /login renders the very first time. Every visit after a choice
 * honours the choice.
 */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value !== undefined && value !== null && (LOCALES as readonly string[]).includes(value);
}

/** the cookie is attacker-controlled input; anything unrecognised is English */
export function pickLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The same shape as the session cookie in lib/session.ts, for the same reasons:
 * first-party, host-only, Lax.
 *
 * - `httpOnly` because nothing in the browser ever reads it. A client component
 *   gets the locale from the provider (`useLocale()`), not from `document.cookie`.
 *   `ui/sidebar.tsx` writes `sidebar_state` from the browser, but that is a
 *   sanctioned fork of generated code, not a pattern to copy.
 * - no `domain`, so the cookie is pinned to this host and the storefront - the
 *   same *site*, a different origin - can neither read it nor shadow it.
 * - a year, not a session. This is a preference, and it deliberately outlives
 *   `logout()`, which only deletes the session cookie: a Vietnamese operator's
 *   next /login should still be Vietnamese.
 */
export const LOCALE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;
