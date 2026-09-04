import "server-only";
import { cookies } from "next/headers";

/**
 * The three short-lived cookies that carry state across the round trip to
 * Google. SameSite=Lax is both required and sufficient: the callback arrives as
 * a top-level GET navigation, which Lax allows, while a cross-site POST or an
 * embedded request - the shapes CSRF actually takes - would not carry them.
 *
 * The names are prefixed `inkhaus_web_` so that running the storefront and the
 * back office on two ports of localhost - which is exactly what `npm run dev`
 * does - cannot have one sign-in clobber the other's half-finished one. Cookies
 * ignore ports; only the name keeps them apart.
 */
const STATE = "inkhaus_web_oauth_state";
const VERIFIER = "inkhaus_web_oauth_verifier";
const NEXT = "inkhaus_web_oauth_next";

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 600, // ten minutes is more than a sign-in takes and less than a nuisance
} as const;

export async function startOauth(state: string, verifier: string, next: string) {
  const jar = await cookies();
  jar.set(STATE, state, options);
  jar.set(VERIFIER, verifier, options);
  jar.set(NEXT, next, options);
}

export async function readOauth() {
  const jar = await cookies();
  return {
    state: jar.get(STATE)?.value ?? null,
    verifier: jar.get(VERIFIER)?.value ?? null,
    next: jar.get(NEXT)?.value ?? "/account",
  };
}

/** always called on the way out of the callback, success or failure */
export async function clearOauth() {
  const jar = await cookies();
  for (const name of [STATE, VERIFIER, NEXT]) jar.delete(name);
}
