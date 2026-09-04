"use server";

import { redirect } from "next/navigation";

import { accountApi } from "@/lib/server-api";
import { clearSession } from "@/lib/session";

// Signing in is not an action: it is a redirect out to Google and back, which
// only a Route Handler can do. See src/app/api/auth/google/.

export async function signOut() {
  // best effort: kill the session server side, then drop the cookie regardless.
  // A shopper who clicked "sign out" must end up signed out of this browser
  // even if the API is unreachable at that moment.
  await accountApi.logout().catch(() => {});
  await clearSession();
  redirect("/");
}
