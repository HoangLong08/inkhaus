import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { authorizeUrl, codeChallenge, isGoogleConfigured } from "@/lib/google";
import { startOauth } from "@/lib/oauth-cookies";
import { safeNext } from "@/lib/safe-next";

/**
 * POST, not GET, on purpose. A GET would be a link, and Next prefetches links -
 * hovering the sign-in button would mint and then discard a state cookie,
 * breaking the click that follows. A plain form POST also means the login page
 * needs no client JavaScript at all.
 */
export async function POST(request: NextRequest) {
  if (!isGoogleConfigured()) {
    redirect("/login?error=" + encodeURIComponent("Google sign-in is not configured yet."));
  }

  const form = await request.formData();
  const next = safeNext(form.get("next")?.toString());

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");

  await startOauth(state, verifier, next);
  redirect(authorizeUrl(state, await codeChallenge(verifier)));
}
