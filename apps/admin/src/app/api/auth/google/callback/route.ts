import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import type { LoginErrorCode } from "@/i18n/login-errors";
import { adminApi, ApiError } from "@/lib/api";
import { exchangeCode } from "@/lib/google";
import { clearOauth, readOauth } from "@/lib/oauth-cookies";
import { safeNext } from "@/lib/safe-next";
import { startSession } from "@/lib/session";

/**
 * Back to the login page with a CODE, never a sentence.
 *
 * The page that receives this is translated, and a page cannot translate a
 * sentence it was handed pre-baked. So the URL carries the machine fact and
 * /login owns the words - the same code-beside-message discipline
 * @inkhaus/shared/admin already uses for staff errors. The codes are the keys of
 * `Login.errors` in messages/{en,vi}.json; an unrecognised one renders UNKNOWN.
 */
function fail(code: LoginErrorCode): never {
  redirect(`/login?error=${code}`);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { state, verifier, next } = await readOauth();

  // whatever happens from here, these are spent
  await clearOauth();

  // the user pressed "cancel" on Google's consent screen
  const googleError = params.get("error");
  if (googleError) fail("CANCELLED");

  const returnedState = params.get("state");
  const code = params.get("code");

  // A missing cookie means the flow did not start here - a bookmarked callback,
  // a stale tab, or a forged link. A mismatch means the state was tampered
  // with. Both are the CSRF case and neither is worth distinguishing.
  if (!state || !verifier || !returnedState || returnedState !== state) {
    fail("EXPIRED");
  }
  if (!code) fail("NO_CODE");

  let idToken: string;
  try {
    idToken = await exchangeCode(code, verifier);
  } catch {
    fail("EXCHANGE");
  }

  let session: Awaited<ReturnType<typeof adminApi.auth.loginWithGoogle>>;
  try {
    session = await adminApi.auth.loginWithGoogle(idToken);
  } catch (err) {
    if (err instanceof ApiError) {
      // 403 is the allowlist refusing a perfectly valid Google account, which
      // is the one failure worth naming precisely - anything else is noise.
      if (err.status === 403) fail("NOT_ALLOWED");
      if (err.status === 0) fail("UNREACHABLE");
      if (err.status === 429) fail("RATE_LIMITED");
      fail("UNKNOWN");
    }
    throw err;
  }

  await startSession(session.token, session.expiresAt);
  redirect(safeNext(next));
}
