import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { exchangeCode } from "@/lib/google";
import { clearOauth, readOauth } from "@/lib/oauth-cookies";
import { safeNext } from "@/lib/safe-next";
import { accountApi, ApiError } from "@/lib/server-api";
import { startSession } from "@/lib/session";

/** back to the sign-in page with a message the shopper can act on */
function fail(message: string): never {
  redirect(`/sign-in?error=${encodeURIComponent(message)}`);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { state, verifier, next } = await readOauth();

  // whatever happens from here, these are spent
  await clearOauth();

  // the shopper pressed "cancel" on Google's consent screen
  if (params.get("error")) fail("Sign-in was cancelled.");

  const returnedState = params.get("state");
  const code = params.get("code");

  // A missing cookie means the flow did not start here - a bookmarked callback,
  // a stale tab, or a forged link. A mismatch means the state was tampered
  // with. Both are the CSRF case and neither is worth distinguishing.
  if (!state || !verifier || !returnedState || returnedState !== state) {
    fail("That sign-in link has expired. Please try again.");
  }
  if (!code) fail("Google did not return an authorization code.");

  let idToken: string;
  try {
    idToken = await exchangeCode(code, verifier);
  } catch {
    fail("Could not complete sign-in with Google. Please try again.");
  }

  let session: Awaited<ReturnType<typeof accountApi.loginWithGoogle>>;
  try {
    session = await accountApi.loginWithGoogle(idToken);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 0) fail("Could not reach the INKHAUS server. Please try again.");
      if (err.status === 429) fail("Too many sign-in attempts. Wait a minute and try again.");
      // 401 covers both a token that failed verification and the one refusal
      // worth naming: an address Google has not verified.
      if (err.status === 401) fail(err.message);
      fail("Sign-in failed. Please try again.");
    }
    throw err;
  }

  await startSession(session.token, session.expiresAt);
  redirect(safeNext(next));
}
