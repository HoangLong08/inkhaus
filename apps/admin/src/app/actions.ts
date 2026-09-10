"use server";

import { redirect } from "next/navigation";

import { adminApi } from "@/lib/api";
import { clearSession } from "@/lib/session";

// Signing in is not an action: it is a redirect out to Google and back, which
// only a Route Handler can do. See src/app/api/auth/google/.
//
// Signing out is the last action left here. The two status writes moved to
// route handlers under src/app/api/admin, because the controls that drive them
// are Radix Selects - a button plus a portalled listbox, which submit nothing
// with JavaScript off. Keeping the actions as a "fallback" would have left a
// second authorization path that nothing could reach and no test could cover.
// The rules those actions enforced live in src/lib/mutations/, which the route
// handlers call, so there is one place to audit rather than two.

export async function logout() {
  // best effort: kill the session server side, then drop the cookie regardless
  await adminApi.auth.logout().catch(() => {});
  await clearSession();
  redirect("/login");
}
